import { initialNodes, initialEdges } from "./initialElements.js";
import ELK from "elkjs/lib/elk.bundled.js";
import React, {
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
} from "react";
import {
  Background,
  MiniMap,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  Panel,
  useNodesState,
  useEdgesState,
  MarkerType,
  useReactFlow,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

const elk = new ELK();

// Elk has a *huge* amount of options to configure. To see everything you can
// tweak check out:
//
// - https://www.eclipse.org/elk/reference/algorithms.html
// - https://www.eclipse.org/elk/reference/options.html
const elkOptions = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.edgeRouting": "SPLINES",
  "elk.layered.edgeRouting.splines.mode": "CONSERVATIVE",
  // "elk.layered.edgeRouting.splines.sloppy.layerSpacingFactor": 0.2,
  "elk.layered.layering.strategy": "NETWORK_SIMPLEX",
  "elk.layered.spacing.nodeNodeBetweenLayers": 200,
  "elk.spacing.nodeNodeBetweenLayers": 100,
  "elk.spacing.nodeNode": 70,
  "elk.spacing.edgeEdge": 20,
  "elk.spacing.edgeNode": 35,
};

function nodeStyle(node) {
  switch (node.pkgType) {
    case "std":
      return {
        backgroundColor: "#ecfccb",
      };
    case "ext":
      return {
        backgroundColor: "#eff6ff",
      };
    default:
      return {};
  }
}

const getLayoutedElements = (nodes, edges, options = {}) => {
  const graph = {
    id: "root",
    layoutOptions: options,
    children: nodes.map((node) => ({
      ...node,
      // Adjust the target and source handle positions based on the layout
      // direction.
      targetPosition: "left",
      sourcePosition: "right",

      // Hardcode a width and height for elk to use when layouting.
      width: (function () {
        // TODO: Provede this into elk options to use in the layouting
        const minWidth = 150;
        const textWidth = node.data.label.length * 7;
        return Math.max(minWidth, textWidth);
      })(),
      height: 50,
    })),
    edges: edges,
  };

  return elk
    .layout(graph)
    .then((layoutedGraph) => ({
      nodes: layoutedGraph.children.map((node) => ({
        ...node,
        // React Flow expects a position property on the node instead of `x`
        // and `y` fields.
        position: { x: node.x, y: node.y },
        style: nodeStyle(node),
        connectable: false,
        deletable: false,
      })),

      edges: layoutedGraph.edges?.map((edge) => ({
        ...edge,
        // animated: true,
        deletable: false,
        reconnectable: false,
        markerEnd: {
          type: MarkerType.Arrow,
          width: 24,
          height: 24,
        },
      })),
    }))
    .catch(console.error);
};

function filterGraph(nodes, edges, mode, selectedNodeId = null) {
  if (!!selectedNodeId) {
    const ns = nodes.filter((n) => {
      return (
        n.id === selectedNodeId ||
        edges.some((e) => e.source === n.id && e.target === selectedNodeId) ||
        edges.some((e) => e.target === n.id && e.source === selectedNodeId)
      );
    });
    const es = edges.filter(
      (e) =>
        ns.some((n) => selectedNodeId === e.source) ||
        ns.some((n) => selectedNodeId === e.target)
    );

    return {
      ns,
      es,
    };
  }

  switch (mode) {
    case "all":
      return { ns: nodes, es: edges };
    case "local":
      const ns = nodes.filter((n) => n.pkgType === "local");
      const es = edges.filter(
        (e) =>
          ns.some((n) => n.id === e.source) && ns.some((n) => n.id === e.target)
      );

      return {
        ns,
        es,
      };
    case "notStd":
      const nsnotStd = nodes.filter((n) => n.pkgType !== "std");
      const esnotStd = edges.filter(
        (e) =>
          nsnotStd.some((n) => n.id === e.source) &&
          nsnotStd.some((n) => n.id === e.target)
      );

      return {
        ns: nsnotStd,
        es: esnotStd,
      };
  }

  return { ns: nodes, es: edges };
}

function LayoutFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();

  const onLayout = useCallback(
    ({ mode = "local", selectedNodeId = null }) => {
      const opts = elkOptions;
      let { ns, es } = filterGraph(
        initialNodes,
        initialEdges,
        mode,
        selectedNodeId
      );
      ns = ns.map((n) => ({ ...n, position: { x: 0, y: 0 } }));

      getLayoutedElements(ns, es, opts).then(
        ({ nodes: layoutedNodes, edges: layoutedEdges }) => {
          setNodes(layoutedNodes);
          setEdges(layoutedEdges);

          window.requestAnimationFrame(() => fitView());
        }
      );
    },
    [nodes, edges]
  );

  // Calculate the initial layout on mount.
  useLayoutEffect(() => {
    onLayout({ mode: "local" });
  }, []);

  // State to track the currently hovered node
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  // Event handlers to manage hover state
  const onNodeMouseEnter = useCallback((event, node) => {
    setHoveredNodeId(node.id);
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  // Effect to update styles based on hovered node
  useEffect(() => {
    // Build a set of connected node IDs including the hovered node
    const connectedNodeIds = new Set();

    if (hoveredNodeId) {
      connectedNodeIds.add(hoveredNodeId);

      edges.forEach((edge) => {
        if (edge.source === hoveredNodeId) {
          connectedNodeIds.add(edge.target);
        } else if (edge.target === hoveredNodeId) {
          connectedNodeIds.add(edge.source);
        }
      });
    }

    // Update node styles
    setNodes((nds: any) =>
      nds.map((node) => {
        if (hoveredNodeId && !connectedNodeIds.has(node.id)) {
          return {
            ...node,
            style: { ...nodeStyle(node), opacity: 0.2 }, // Make node pale
          };
        } else {
          return {
            ...node,
            style: { ...nodeStyle(node), opacity: 1.0 }, // Make node pale
          };
        }
      })
    );

    // Update edge styles
    setEdges((eds: any) =>
      eds.map((edge) => {
        if (hoveredNodeId) {
          if (edge.source === hoveredNodeId || edge.target === hoveredNodeId) {
            return {
              ...edge,
              style: { stroke: "red" }, // Highlight connected edges
              markerEnd: {
                type: MarkerType.Arrow,
                color: "red",
                width: 32,
                height: 32,
              },
            };
          } else {
            return {
              ...edge,
              style: { opacity: 0.1 }, // Make edge pale
              markerEnd: {
                type: MarkerType.Arrow,
                color: null,
                width: 24,
                height: 24,
              },
            };
          }
        } else {
          return {
            ...edge,
            style: {}, // Reset to default style
            markerEnd: {
              type: MarkerType.Arrow,
              width: 24,
              height: 24,
            },
          };
        }
      })
    );
  }, [hoveredNodeId, setNodes, setEdges, edges]);

  // Event handlers to manage hover state
  const onNodeClick = useCallback((event, node) => {
    console.log("node clicked", node);
    onLayout({ mode: "local", selectedNodeId: node.id });
  }, []);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onNodeMouseEnter={onNodeMouseEnter}
      onNodeMouseLeave={onNodeMouseLeave}
      minZoom={0.2}
      style={{ background: "#F7F9FB" }}
      maxZoom={4}
      attributionPosition="bottom-left"
      fitView
      fitViewOptions={{ padding: 0.5 }}
    >
      <Panel position="top-right">
        <button onClick={() => onLayout({ mode: "all" })}>all</button>
        <button onClick={() => onLayout({ mode: "local" })}>local</button>
        <button onClick={() => onLayout({ mode: "notStd" })}>not std</button>
      </Panel>
      <Background />
      <MiniMap />
      <Controls />
    </ReactFlow>
  );
}

export default () => (
  <ReactFlowProvider>
    <LayoutFlow />
  </ReactFlowProvider>
);
