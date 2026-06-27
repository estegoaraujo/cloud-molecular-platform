"""
Endpoint tests for POST /simulate/thermal.

A fake `TrajectoryStore` is injected via dependency_overrides so the test runs
end-to-end through parsing, simulation, and serialization with NO Supabase or
network involvement — and can assert on exactly what would have been uploaded.
"""

import io

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.deps import get_storage

SAMPLE_PDB = b"""\
TITLE     TEST MOLECULE
ATOM      1  N   ALA A   1      11.104   6.134  -6.504  1.00  0.00           N
ATOM      2  CA  ALA A   1      12.560   6.087  -6.246  1.00  0.00           C
ATOM      3  C   ALA A   1      12.954   4.690  -5.793  1.00  0.00           C
END
"""


class FakeStore:
    """Records what was saved and returns a deterministic fake signed URL."""

    def __init__(self):
        self.saved = []

    def resolve_user_id(self, access_token):
        return "user-from-token" if access_token else "dev-anonymous"

    def save(self, *, user_id, sim_id, filename, data, content_type):
        self.saved.append(
            dict(
                user_id=user_id,
                sim_id=sim_id,
                filename=filename,
                data=data,
                content_type=content_type,
            )
        )
        path = f"{user_id}/{sim_id}/{filename}"
        return path, f"https://fake.local/{path}?token=signed"


@pytest.fixture
def client_and_store():
    store = FakeStore()
    app.dependency_overrides[get_storage] = lambda: store
    with TestClient(app) as client:
        yield client, store
    app.dependency_overrides.clear()


def test_simulate_thermal_happy_path(client_and_store):
    client, store = client_and_store
    resp = client.post(
        "/simulate/thermal",
        files={"file": ("mol.pdb", io.BytesIO(SAMPLE_PDB), "chemical/x-pdb")},
        data={"n_frames": "20", "output_format": "pdb"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["n_atoms"] == 3
    assert body["n_frames"] == 20
    assert body["engine"] == "mock-thermal-noise-v1"
    assert body["file_url"].startswith("https://fake.local/")

    # The uploaded payload should be a multi-frame PDB with 20 models.
    assert len(store.saved) == 1
    payload = store.saved[0]["data"].decode()
    assert payload.count("MODEL ") == 20


def test_simulate_uses_bearer_token_for_user_namespace(client_and_store):
    client, store = client_and_store
    resp = client.post(
        "/simulate/thermal",
        files={"file": ("mol.pdb", io.BytesIO(SAMPLE_PDB), "chemical/x-pdb")},
        headers={"Authorization": "Bearer abc.def.ghi"},
    )
    assert resp.status_code == 200
    assert store.saved[0]["user_id"] == "user-from-token"


def test_rejects_non_pdb_extension(client_and_store):
    client, _ = client_and_store
    resp = client.post(
        "/simulate/thermal",
        files={"file": ("mol.txt", io.BytesIO(SAMPLE_PDB), "text/plain")},
    )
    assert resp.status_code == 400


def test_rejects_empty_pdb(client_and_store):
    client, _ = client_and_store
    resp = client.post(
        "/simulate/thermal",
        files={"file": ("mol.pdb", io.BytesIO(b"HEADER nothing\nEND\n"), "chemical/x-pdb")},
    )
    assert resp.status_code == 422

    