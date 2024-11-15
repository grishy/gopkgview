import React, { useLayoutEffect, useCallback, useState } from "react";
import ELK from "elkjs/lib/elk.bundled.js";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  Panel,
  ReactFlowProvider,
  MarkerType,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

const elk = new ELK();

// Elk has a *huge* amount of options to configure. To see everything you can
// tweak check out:
//
// - https://www.eclipse.org/elk/reference/algorithms.html
// - https://www.eclipse.org/elk/reference/options.html
// TODO: Review the options and adjust them by default.
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

const { initialNodes, initialEdges } = await initialData();

const getLayoutedElements = async (nodes, edges) => {
  // Convert for ELK
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

        targetPosition: "left",
        sourcePosition: "right",

        connectable: false,
        deletable: false,
      })),

      edges: layoutedGraph.edges.map((e) => ({
        ...e,

        deletable: false,
        reconnectable: false,
        markerEnd: {
          type: MarkerType.Arrow,
          width: 24,
          height: 24,
        },
      })),
    };
  } catch (data) {
    return console.error(data);
  }
};

function LayoutFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { fitView } = useReactFlow();

  const [displayStd, setDisplayStd] = useState(false);
  const [displayLoc, setDisplayLoc] = useState(true);
  const [displayExt, setDisplayExt] = useState(false);
  const [displayErr, setDisplayErr] = useState(false);

  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  const onLayout = useCallback(async () => {
    let selected = initialNodes;
    if (selectedNode) {
      const sid = selectedNode.id;
      selected = initialNodes.filter(
        (n) =>
          n.id === sid ||
          initialEdges.find((e) => e.source === n.id && e.target === sid) ||
          initialEdges.find((e) => e.target === n.id && e.source === sid)
      );
    }

    const filteredNodes = selected.filter((n) => {
      if (selectedNode && n.id === selectedNode.id) return true;
      if (n.pkgType === "std") return displayStd;
      if (n.pkgType === "loc") return displayLoc;
      if (n.pkgType === "ext") return displayExt;
      if (n.pkgType === "err") return displayErr;

      throw new Error("Unknown node type " + n.pkgType);
    });

    const filteredEdges = initialEdges.filter(
      (e) =>
        filteredNodes.find((n) => n.id === e.source) &&
        filteredNodes.find((n) => n.id === e.target)
    );

    const { nodes, edges } = await getLayoutedElements(
      filteredNodes,
      filteredEdges
    );

    // Fit the view after the layout is done
    setNodes(nodes);
    setEdges(edges);

    // TODO: Hack to force the fitView to run!
    setTimeout(() => {
      window.requestAnimationFrame(() => fitView());
    }, 20);
  }, [displayStd, displayLoc, displayExt, displayErr, selectedNode]);

  // Calculate the initial layout on mount.
  useLayoutEffect(() => {
    onLayout();
  }, [displayStd, displayLoc, displayExt, displayErr, selectedNode]);

  // TODO: simplify this
  const onNodeMouseEnter = useCallback((event, node) => {
    setHoveredNode(node);
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  function ControlButton(text, getter, setter) {
    return (
      <div
        onClick={() => setter(!getter)}
        className={`gopkgview-mode-btn ${
          getter ? "gopkgview-mode-btn-active" : ""
        }`}
      >
        {text}
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodeClick={onNodeClick}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeMouseEnter={onNodeMouseEnter}
      onNodeMouseLeave={onNodeMouseLeave}
      minZoom={0.2}
      maxZoom={4}
      fitView
      fitViewOptions={{ padding: 0.5 }}
    >
      <Panel position="top-left">
        {selectedNode && (
          <div className="gopkgview-ctrl">
            <div
              onClick={() => setSelectedNode(null)}
              className="gopkgview-ctrl-close"
            >
              Close
            </div>
            <span className="gopkgview-ctrl-title">{selectedNode.id}</span>
          </div>
        )}
      </Panel>
      <Panel position="top-right">
        <div className="gopkgview-mode">
          {ControlButton("STD", displayStd, setDisplayStd)}
          {ControlButton("Loc", displayLoc, setDisplayLoc)}
          {ControlButton("External", displayExt, setDisplayExt)}
          {ControlButton("Error", displayErr, setDisplayErr)}
        </div>
      </Panel>
      <Controls />
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

// Get and convert the initial data
async function initialData() {
  const [serverNodes, serverEdges] = await Promise.all([
    fetch("http://localhost:3000/nodes").then((res) => res.json()),
    fetch("http://localhost:3000/edges").then((res) => res.json()),
  ]);

  // TODO: Add type here
  // type: "input"  - first node
  // type: "output" - with no children
  const initialNodes = serverNodes.map((n) => {
    const label = n.PkgType !== "loc" ? n.ImportPath : n.Name;
    // TODO: Hack to make the width of the node dynamic
    const width = Math.max(100, label.length * 7);
    const height = 40;

    return {
      id: n.ImportPath,
      data: { label },
      position: { x: 0, y: 0 },
      pkgType: n.PkgType,
      style: nodeStyle(n.PkgType),
      width,
      height,
    };
  });

  const initialEdges = serverEdges.map((e) => ({
    id: `${e.From}-${e.To}`,
    source: e.From,
    target: e.To,
  }));

  return { initialNodes, initialEdges };
}

function nodeStyle(nodeType) {
  switch (nodeType) {
    case "std":
      return {
        backgroundColor: "#ecfccb",
      };
    case "ext":
      return {
        backgroundColor: "#eff6ff",
      };
    // TODO: Debug this case
    case "err":
      return {
        backgroundColor: "#ffefef",
      };
    default:
      return {};
  }
}
