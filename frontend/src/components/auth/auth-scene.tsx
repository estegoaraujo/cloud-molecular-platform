/**
 * Ambient "viewport" panel shown beside the auth form.
 *
 * A small molecular lattice whose nodes are tinted along the thermal ramp
 * (cold → hot) to preview what the product does: hold a structure, then heat it
 * until bonds destabilize. Animation is a slow opacity pulse only, and is
 * disabled under `prefers-reduced-motion` via globals.css. Purely decorative,
 * so it is hidden from assistive tech.
 */
export function AuthScene() {
  // A hand-placed lattice: [x, y, energy 0..1] where energy drives node color.
  const nodes: [number, number, number][] = [
    [60, 70, 0.05], [150, 50, 0.1], [240, 90, 0.2], [320, 60, 0.15],
    [90, 160, 0.25], [180, 150, 0.5], [270, 170, 0.45], [350, 150, 0.35],
    [60, 250, 0.4], [150, 260, 0.7], [240, 250, 0.85], [330, 240, 0.6],
    [110, 330, 0.6], [200, 340, 0.95], [290, 330, 0.8], [360, 320, 0.7],
  ];
  const bonds: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [0, 4], [1, 5], [2, 6], [3, 7],
    [4, 5], [5, 6], [6, 7], [4, 8], [5, 9], [6, 10], [7, 11],
    [8, 9], [9, 10], [10, 11], [8, 12], [9, 13], [10, 14], [11, 15],
    [12, 13], [13, 14], [14, 15],
  ];

  // Map energy to a color on the cold→warm→hot ramp.
  const colorFor = (e: number) =>
    e < 0.5
      ? lerpColor("#4c8dff", "#f5a623", e / 0.5)
      : lerpColor("#f5a623", "#ff4d6d", (e - 0.5) / 0.5);

  return (
    <svg
      viewBox="0 0 420 400"
      className="h-full w-full"
      aria-hidden="true"
      role="presentation"
    >
      <defs>
        <radialGradient id="glow" cx="50%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#151c2d" />
          <stop offset="100%" stopColor="#07090e" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="420" height="400" fill="url(#glow)" />

      {/* Bonds. Higher-energy nodes get warmer bonds — the lattice "heats". */}
      {bonds.map(([a, b], i) => {
        const e = (nodes[a][2] + nodes[b][2]) / 2;
        return (
          <line
            key={`b${i}`}
            x1={nodes[a][0]}
            y1={nodes[a][1]}
            x2={nodes[b][0]}
            y2={nodes[b][1]}
            stroke={colorFor(e)}
            strokeOpacity={0.35 + e * 0.4}
            strokeWidth={1}
          />
        );
      })}

      {/* Atoms. The pulse rate scales with energy so hot atoms shimmer faster. */}
      {nodes.map(([x, y, e], i) => (
        <circle key={`n${i}`} cx={x} cy={y} r={3 + e * 3} fill={colorFor(e)}>
          <animate
            attributeName="opacity"
            values="0.55;1;0.55"
            dur={`${3.4 - e * 2}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </svg>
  );
}

/** Linear interpolation between two hex colors. */
function lerpColor(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
