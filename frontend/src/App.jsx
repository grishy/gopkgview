import React, {
  useLayoutEffect,
  useCallback,
  useState,
  useEffect,
} from "react";
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

const bgColorErr = "#ffefef";
const bgColorStd = "#ecfccb";
const bgColorExt = "#eff6ff";

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

// React contenxt
// tanstackqeury
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

  // Calculate the initial layout on mount.
  useEffect(() => {
    const fetchData = async () => {
      try {
        const resp = await fetch("/data").then((res) => res.json());

        const initialNodes = resp.nodes.map((n) => {
          const label = n.PkgType !== "loc" ? n.ImportPath : n.Name;
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

        const initialEdges = resp.edges.map((e) => ({
          id: `${e.From}-${e.To}`,
          source: e.From,
          target: e.To,
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

  useLayoutEffect(() => {
    if (!loading && nodes.length > 0) {
      onLayout();
    }
  }, [loading, nodes.length]);

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
    }, 20);
  };

  // TODO: simplify this
  const onNodeMouseEnter = useCallback((event, node) => {
    setHoveredNode(node);
  }, []);

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);

  const onNodeClick = (event, node) => {
    setSelectedNode(node);
  };

  useEffect(() => {
    onLayout();
  }, [params, selectedNode]);

  // Effect to update styles based on hovered node
  useEffect(() => {
    // Build a set of connected node IDs including the hovered node
    const connectedNodeIds = new Set();
    const hoveredNodeId = hoveredNode?.id;

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
    setNodes((nds) =>
      nds.map((node) => {
        if (hoveredNodeId && !connectedNodeIds.has(node.id)) {
          return {
            ...node,
            style: {
              ...node.style,
              opacity: 0.2,
            },
          };
        } else {
          return {
            ...node,
            style: {
              ...node.style,
              opacity: 1.0,
            },
          };
        }
      })
    );

    // Update edge styles
    setEdges((eds) =>
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
  }, [hoveredNode]);

  function ControlButton(text, bgColor, getter, onClick) {
    return (
      <div
        onClick={onClick}
        className={`gopkgview-mode-btn ${
          getter ? "gopkgview-mode-btn-active" : ""
        }`}
        style={{
          backgroundColor: bgColor,
        }}
      >
        {text}
      </div>
    );
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
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
            <div className="gopkgview-ctrl-top">
              <div
                onClick={() => {
                  setParams({ ...params, onlySelectedEdges: false });
                  setHoveredNode(null);
                  setSelectedNode(null);
                }}
                className="gopkgview-ctrl-close"
              >
                Close
              </div>
              <span className="gopkgview-ctrl-title">{selectedNode.id}</span>
            </div>
            <div
              onClick={() =>
                setParams({
                  ...params,
                  onlySelectedEdges: !params.onlySelectedEdges,
                })
              }
              className="gopkgview-ctrl-only"
            >
              Only direct edges {params.onlySelectedEdges ? "ON" : "OFF"}
            </div>
          </div>
        )}
      </Panel>
      <Panel position="top-right">
        <div className="gopkgview-mode">
          {ControlButton("Std", bgColorStd, params.displayStd, () =>
            setParams({ ...params, displayStd: !params.displayStd })
          )}
          {ControlButton("External", bgColorExt, params.displayExt, () =>
            setParams({ ...params, displayExt: !params.displayExt })
          )}
          {ControlButton("Parse Error", bgColorErr, params.displayErr, () =>
            setParams({ ...params, displayErr: !params.displayErr })
          )}
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

function nodeStyle(nodeType) {
  switch (nodeType) {
    case "std":
      return {
        backgroundColor: bgColorStd,
      };
    case "ext":
      return {
        backgroundColor: bgColorExt,
      };
    // TODO: Debug this case
    case "err":
      return {
        backgroundColor: bgColorErr,
      };
    default:
      return {};
  }
}
