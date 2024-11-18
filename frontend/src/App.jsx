import React, {
  useLayoutEffect,
  useCallback,
  useState,
  useEffect,
} from "react";
import {
  ReactFlow,
  MiniMap,
  Background,
  ReactFlowProvider,
  MarkerType,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from "@xyflow/react";
import ELK from "elkjs/lib/elk.bundled.js";

import Controls from "./Controls";

import "@xyflow/react/dist/style.css";

const typeToColor = {
  std: "#ecfccb",
  ext: "#eff6ff",
  err: "#ffefef",
};

const elk = new ELK();

// Elk has a *huge* amount of options to configure. To see everything you can
// tweak check out:
// - https://www.eclipse.org/elk/reference/algorithms.html
// - https://www.eclipse.org/elk/reference/options.html
const elkOptions = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.edgeRouting": "SPLINES",
  "elk.layered.edgeRouting.splines.mode": "CONSERVATIVE",
  "elk.layered.layering.strategy": "NETWORK_SIMPLEX",
  "elk.layered.spacing.nodeNodeBetweenLayers": 200,
  "elk.spacing.nodeNodeBetweenLayers": 100,
  "elk.spacing.nodeNode": 30,
  "elk.spacing.edgeEdge": 20,
  "elk.spacing.edgeNode": 50,
};

const getLayoutedElements = async (nodes, edges) => {
  // All fields will be passed to ELK and saved in the resulting node
  const graph = {
    id: "root",
    layoutOptions: elkOptions,
    edges,
    children: nodes,
  };

  // Run ELK and convert to React Flow format
  try {
    const layoutedGraph = await elk.layout(graph);
    return {
      nodes: layoutedGraph.children.map((n) => ({
        ...n,
        position: { x: n.x, y: n.y },
      })),

      edges: layoutedGraph.edges,
    };
  } catch (data) {
    return console.error(data);
  }
};

function LayoutFlow() {
  const [initialNodes, setInitialNodes] = useState([]);
  const [initialEdges, setInitialEdges] = useState([]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [params, setParams] = useState({
    displayStd: false,
    displayExt: false,
    displayErr: true,
    onlySelectedEdges: false,
  });

  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  const { fitView } = useReactFlow();

  // Initial data download
  useEffect(() => {
    const fetchData = async () => {
      try {
        const resp = await fetch("/data").then((res) => res.json());

        const initialNodes = resp.nodes.map((n) => {
          const label = n.PkgType !== "loc" ? n.ImportPath : n.Name;
          // Yes, this is a hack to make the nodes wider if needed...
          // Yes, this is not a monospace font, so it's not perfect.
          const width = Math.max(80, label.length * 7);
          const height = 40;

          return {
            id: n.ImportPath,
            pkgType: n.PkgType,
            width,
            height,
            // React Flow options
            data: { label },
            position: { x: 0, y: 0 },
            style: {
              background: typeToColor[n.PkgType],
            },
            targetPosition: "left",
            sourcePosition: "right",
            connectable: false,
            deletable: false,
          };
        });

        const initialEdges = resp.edges.map((e) => ({
          id: `${e.From}-${e.To}`,
          source: e.From,
          target: e.To,
          // React Flow options
          deletable: false,
          reconnectable: false,
          markerEnd: {
            type: MarkerType.Arrow,
            width: 24,
            height: 24,
          },
        }));

        setInitialNodes(initialNodes);
        setInitialEdges(initialEdges);
        setNodes(initialNodes);
        setEdges(initialEdges);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Initial
  useEffect(() => {
    onLayout();
  }, [
    // Initial layout
    initialNodes,
    initialEdges,
    // Update on changes
    params,
    selectedNode,
  ]);

  const onLayout = async () => {
    let selected = initialNodes;
    if (selectedNode) {
      selected = [];
      const sid = selectedNode.id;

      for (const n of initialNodes) {
        if (n.id === sid) {
          n.style = {
            ...n.style,
            border: "2px solid rgb(16 185 129)",
          };
          selected.push(n);
          continue;
        }
        for (const e of initialEdges) {
          if (e.source === n.id && e.target === sid) {
            n.style = {
              ...n.style,
              border: "2px solid rgb(249 115 22)",
            };
            selected.push(n);
            break;
          }

          if (e.target === n.id && e.source === sid) {
            n.style = {
              ...n.style,
              border: "2px solid rgb(120 113 108)",
            };
            selected.push(n);
            break;
          }
        }
      }
    }

    const filteredNodes = selected.filter((n) => {
      if (selectedNode && n.id === selectedNode.id) return true;
      if (n.pkgType === "loc") return true;
      if (n.pkgType === "std") return params.displayStd;
      if (n.pkgType === "ext") return params.displayExt;
      if (n.pkgType === "err") return params.displayErr;

      throw new Error("Unknown node type " + n.pkgType);
    });

    let filteredEdges = initialEdges.filter(
      (e) =>
        filteredNodes.find((n) => n.id === e.source) &&
        filteredNodes.find((n) => n.id === e.target)
    );

    if (params.onlySelectedEdges) {
      filteredEdges = filteredEdges.filter(
        (e) => selectedNode.id === e.source || selectedNode.id === e.target
      );
    }

    const { nodes, edges } = await getLayoutedElements(
      filteredNodes,
      filteredEdges
    );

    // Fit the view after the layout is done
    setNodes(nodes);
    setEdges(edges);
    setHoveredNode(null);

    // TODO: Hack to force the fitView to run!
    setTimeout(() => {
      window.requestAnimationFrame(() => fitView());
    }, 16);
  };

  // TODO: simplify this

  // Effect to update styles based on hovered node
  useEffect(
    () => onHoverChange(hoveredNode, edges, setNodes, setEdges),
    [hoveredNode]
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(event, node) => {
        setSelectedNode(node);
      }}
      onNodeMouseEnter={(event, node) => {
        setHoveredNode(node);
      }}
      onNodeMouseLeave={() => {
        setHoveredNode(null);
      }}
      minZoom={0.1}
      maxZoom={3}
      fitView
      fitViewOptions={{ padding: 0.5 }}
    >
      <Controls
        hoveredNode={hoveredNode}
        setParams={setParams}
        setHoveredNode={setHoveredNode}
        setSelectedNode={setSelectedNode}
        params={params}
        selectedNode={selectedNode}
      />
      <MiniMap />
      <Background variant="dots" gap={12} size={1} />
    </ReactFlow>
  );
}

export default function App() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlowProvider>
        <LayoutFlow />
      </ReactFlowProvider>
    </div>
  );
}
function onHoverChange(hoveredNode, edges, setNodes, setEdges) {
  const hoveredNodeId = hoveredNode?.id;
  
  if (!hoveredNodeId) {
    // Reset all styles when no node is hovered
    setNodes(nodes => nodes.map(node => ({ ...node, style: { ...node.style, opacity: 1.0 } })));
    setEdges(edges => edges.map(edge => ({
      ...edge,
      style: {},
      markerEnd: { type: MarkerType.Arrow, width: 24, height: 24 }
    })));
    return;
  }

  // Find nodes that are connected to the hovered node
  const connectedNodes = new Set([
    hoveredNodeId,
    ...edges
      .filter(edge => edge.source === hoveredNodeId || edge.target === hoveredNodeId)
      .flatMap(edge => [edge.source, edge.target])
  ]);

  // Update nodes
  setNodes(nodes => nodes.map(node => ({
    ...node,
    style: {
      ...node.style,
      opacity: connectedNodes.has(node.id) ? 1.0 : 0.2
    }
  })));

  // Update edges
  setEdges(edges => edges.map(edge => {
    const isConnected = edge.source === hoveredNodeId || edge.target === hoveredNodeId;
    return {
      ...edge,
      style: isConnected ? { stroke: "red" } : { opacity: 0.1 },
      markerEnd: {
        type: MarkerType.Arrow,
        ...(isConnected ? { color: "red", width: 32, height: 32 } : { width: 24, height: 24 })
      }
    };
  }));
}
