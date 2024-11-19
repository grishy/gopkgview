import React, {
  useLayoutEffect,
  useCallback,
  useState,
  useEffect,
} from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  ReactFlowProvider,
  MarkerType,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from "@xyflow/react";
import ELK from "elkjs/lib/elk.bundled.js";

import GoPkgViewControls from "./GoPkgViewControls";

import "@xyflow/react/dist/style.css";

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

const typeToColor = {
  std: "#ecfccb",
  ext: "#eff6ff",
  err: "#ffefef",
};

const colorIn = "rgb(34 197 94)";
const colorOut = "rgb(59 130 246)";
const defaultMarker = { type: MarkerType.Arrow, width: 24, height: 24 };

const getLayoutedElements = async (nodes, edges) => {
  // All fields will be passed to ELK and saved in the resulting node
  const elkGraph = {
    id: "root",
    layoutOptions: elkOptions,
    edges,
    children: nodes,
  };

  try {
    const { children, edges: layoutedEdges } = await elk.layout(elkGraph);
    const layoutedNodes = children.map(({ x, y, ...node }) => ({
      ...node,
      position: { x, y },
    }));

    return { nodes: layoutedNodes, edges: layoutedEdges };
  } catch (error) {
    console.error("ELK layout failed:", error);
    return { nodes, edges };
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
    const createNode = (n) => ({
      id: n.ImportPath,
      pkgType: n.PkgType,
      // TODO: Either use a monospace font or calculate the width better?
      width: Math.max(
        80,
        (n.PkgType !== "loc" ? n.ImportPath : n.Name).length * 7
      ),
      height: 40,
      // React Flow options
      data: { label: n.PkgType !== "loc" ? n.ImportPath : n.Name },
      position: { x: 0, y: 0 },
      style: { background: typeToColor[n.PkgType] },
      targetPosition: "left",
      sourcePosition: "right",
      connectable: false,
      deletable: false,
    });

    const createEdge = (e) => ({
      id: `${e.From}-${e.To}`,
      source: e.From,
      target: e.To,
      // React Flow options
      deletable: false,
      reconnectable: false,
      markerEnd: { type: MarkerType.Arrow, width: 24, height: 24 },
    });

    const fetchData = async () => {
      try {
        const { nodes, edges } = await fetch("/data").then((res) => res.json());
        const initialNodes = nodes.map(createNode);
        const initialEdges = edges.map(createEdge);

        setInitialNodes(initialNodes);
        setInitialEdges(initialEdges);
        setNodes(initialNodes);
        setEdges(initialEdges);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Initial
  useEffect(() => {
    onLayout({
      initialNodes,
      initialEdges,
      params,
      selectedNode,
      setNodes,
      setEdges,
      fitView,
    });
    setHoveredNode(null);
  }, [
    // Initial layout
    initialNodes,
    initialEdges,
    // Update on changes
    params,
    selectedNode,
  ]);

  // Effect to update styles based on hovered node
  useEffect(
    () => onHoverChange(hoveredNode, selectedNode, edges, setNodes, setEdges),
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
      <MiniMap nodeStrokeWidth={3} />
      <Controls />
      <GoPkgViewControls
        hoveredNode={hoveredNode}
        setParams={setParams}
        setHoveredNode={setHoveredNode}
        setSelectedNode={setSelectedNode}
        params={params}
        selectedNode={selectedNode}
      />
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

async function onLayout({
  initialNodes,
  initialEdges,
  params,
  selectedNode,
  setNodes,
  setEdges,
  fitView,
}) {
  let selected = initialNodes;

  if (selectedNode) {
    const selectedId = selectedNode.id;

    selected = initialNodes.filter((node) => {
      // Include the selected node itself
      if (node.id === selectedId) return true;

      // Include nodes that have direct connections with the selected node
      return initialEdges.some(
        (edge) =>
          (edge.source === node.id && edge.target === selectedId) ||
          (edge.target === node.id && edge.source === selectedId)
      );
    });

    // selected = selected.map((n) => {
    //   if (n.id === selectedId) {
    //     return { ...n, style: { ...n.style, border: "2px solid red" } };
    //   }

    //   return n;
    // });
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
    ({ source, target }) =>
      filteredNodes.some((node) => node.id === source) &&
      filteredNodes.some((node) => node.id === target)
  );

  if (params.onlySelectedEdges) {
    filteredEdges = filteredEdges.filter(
      (e) => selectedNode.id === e.source || selectedNode.id === e.target
    );
  }

  const layout = await getLayoutedElements(filteredNodes, filteredEdges);

  // Update type to not show connections dots everywhere on node fron both sides
  layout.nodes.forEach((node) => {
    const hasInput = filteredEdges.some((edge) => edge.target === node.id);
    const hasOutput = filteredEdges.some((edge) => edge.source === node.id);

    if (hasInput && hasOutput) {
      node.type = "default";
    } else if (hasInput) {
      node.type = "output";
    } else if (hasOutput) {
      node.type = "input";
    }
  });

  if (selectedNode) {
    layout.edges = selectedEdges(selectedNode, layout.edges);
  }

  setNodes(layout.nodes);
  setEdges(layout.edges);

  // TODO: Remove this hack
  // Fit the view after the layout is done
  setTimeout(() => {
    window.requestAnimationFrame(() => fitView());
  }, 20);
}

function onHoverChange(hoveredNode, selectedNode, edges, setNodes, setEdges) {
  const highlightedMarker = {
    ...defaultMarker,
    color: "red",
    width: 32,
    height: 32,
  };

  // Reset state when no node is hovered
  if (!hoveredNode) {
    setNodes((nodes) =>
      nodes.map((node) => ({
        ...node,
        style: { ...node.style, opacity: 1.0 },
      }))
    );

    setEdges((edges) =>
      edges.map((edge) => ({
        ...edge,
        style: {},
        markerEnd: defaultMarker,
      }))
    );

    if (selectedNode) {
      setEdges((edges) => {
        return selectedEdges(selectedNode, edges);
      });
    }

    return;
  }

  // Find all nodes connected to the hovered node
  const connectedNodes = new Set([
    hoveredNode.id,
    ...edges
      .filter(
        (edge) =>
          edge.source === hoveredNode.id || edge.target === hoveredNode.id
      )
      .flatMap((edge) => [edge.source, edge.target]),
  ]);

  // Update node visibility
  setNodes((nodes) =>
    nodes.map((node) => ({
      ...node,
      style: {
        ...node.style,
        opacity: connectedNodes.has(node.id) ? 1.0 : 0.2,
      },
    }))
  );

  // Update edge styling
  setEdges((edges) =>
    edges.map((edge) => {
      const isConnected =
        edge.source === hoveredNode.id || edge.target === hoveredNode.id;

      return {
        ...edge,
        style: isConnected ? { stroke: "red" } : { opacity: 0.1 },
        markerEnd: isConnected ? highlightedMarker : defaultMarker,
      };
    })
  );
}

function selectedEdges(selectedNode, eds) {
  return eds.map((e) => {
    if (e.target === selectedNode.id) {
      return {
        ...e,
        style: { stroke: colorIn },
        markerEnd: {
          ...defaultMarker,
          color: colorIn,
        },
      };
    }

    if (e.source === selectedNode.id) {
      return {
        ...e,
        style: { stroke: colorOut },
        markerEnd: {
          ...defaultMarker,
          color: colorOut,
        },
      };
    }

    return e;
  });
}
