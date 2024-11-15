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
  const isHorizontal = options?.["elk.direction"] === "RIGHT";
  const graph = {
    id: "root",
    layoutOptions: options,
    children: nodes.map((node) => ({
      ...node,
      // Adjust the target and source handle positions based on the layout
      // direction.
      targetPosition: isHorizontal ? "left" : "top",
      sourcePosition: isHorizontal ? "right" : "bottom",

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

function LayoutFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();

  // const onConnect = useCallback(
  //   (params) => setEdges((eds) => addEdge(params, eds)),
  //   []
  // );
  const onLayout = useCallback(
    ({ direction, useInitialNodes = false }) => {
      const opts = { "elk.direction": direction, ...elkOptions };
      const ns = useInitialNodes ? initialNodes : nodes;
      const es = useInitialNodes ? initialEdges : edges;

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
    onLayout({ direction: "DOWN", useInitialNodes: true });
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

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      // onConnect={onConnect}
      onNodesChange={onNodesChange}
      onNodeMouseEnter={onNodeMouseEnter}
      onNodeMouseLeave={onNodeMouseLeave}
      // onEdgesChange={onEdgesChange}
      fitView
      style={{ backgroundColor: "#F7F9FB" }}
    >
      <Panel position="top-right">
        <button onClick={() => onLayout({ direction: "DOWN" })}>
          vertical layout
        </button>

        <button onClick={() => onLayout({ direction: "RIGHT" })}>
          horizontal layout
        </button>
      </Panel>
      <Background />
    </ReactFlow>
  );
}

export default () => (
  <ReactFlowProvider>
    <LayoutFlow />
  </ReactFlowProvider>
);
