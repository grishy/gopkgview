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
  "elk.spacing.nodeNode": 70,
  "elk.spacing.edgeEdge": 20,
  "elk.spacing.edgeNode": 35,
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

  const onLayout = useCallback(async () => {
    console.log(displayStd, displayLoc, displayExt, displayErr);

    const filteredNodes = initialNodes.filter((n) => {
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

    console.log(filteredNodes, filteredEdges);

    const { nodes: layoutedNodes, edges: layoutedEdges } =
      await getLayoutedElements(filteredNodes, filteredEdges);

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [nodes, edges, displayStd, displayLoc, displayExt, displayErr]);

  // Calculate the initial layout on mount.
  useLayoutEffect(() => {
    onLayout();
  }, [displayStd, displayLoc, displayExt, displayErr]);

  // Fit the view after the layout has been calculated.
  useLayoutEffect(() => {
    window.requestAnimationFrame(() => fitView());
  }, [nodes, edges]);

  function btn(text, getter, setter) {
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
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      minZoom={0.2}
      maxZoom={4}
      fitView
      fitViewOptions={{ padding: 0.5 }}
    >
      <Panel position="top-right">
        <div className="gopkgview-mode">
          {btn("STD", displayStd, setDisplayStd)}
          {btn("Loc", displayLoc, setDisplayLoc)}
          {btn("External", displayExt, setDisplayExt)}
          {btn("Error", displayErr, setDisplayErr)}
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
    const width = Math.max(150, n.Name.length * 7);
    const height = 50;

    return {
      id: n.ImportPath,
      data: { label: n.Name },
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
