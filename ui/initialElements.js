export const initialNodes = await fetch('nodes.json').then((res) => res.json());
export const initialEdges = await fetch('edges.json').then((res) => res.json());
