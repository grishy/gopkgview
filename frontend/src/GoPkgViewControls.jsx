import { Panel } from "@xyflow/react";
import "./controls.css";

function ControlButton({ text, getter, onClick, description }) {
  const activeClass = getter ? `gopkgview-btn-active` : "";

  return (
    <div
      title={description}
      onClick={onClick}
      className={`gopkgview-btn ${activeClass}`}
    >
      {text}
    </div>
  );
}

function Selected({
  selectedNode,
  setParams,
  setSelectedNode,
  params,
  setHoveredNode,
}) {
  if (!selectedNode) return null;
  return (
    <>
      <div className="gopkgview-ctrl-top">
        <div
          onClick={() => {
            setParams({ ...params, onlySelectedEdges: false });
            setHoveredNode(null);
            setSelectedNode(null);
          }}
          className="gopkgview-btn gopkgview-btn-close"
        >
          ✕ Unselect
        </div>
        <div
          onClick={() =>
            setParams({
              ...params,
              onlySelectedEdges: !params.onlySelectedEdges,
            })
          }
          className={`gopkgview-btn ${
            params.onlySelectedEdges ? "gopkgview-btn-active" : ""
          }`}
        >
          Show only direct edges
        </div>
      </div>
      <span className="gopkgview-ctrl-title">{selectedNode.id}</span>
    </>
  );
}

export default function GoPkgViewControls({
  hoveredNode,
  params,
  setParams,
  setHoveredNode,
  setSelectedNode,
  selectedNode,
}) {
  const controlModeBtn = [
    {
      text: "External",
      getter: params.displayExt,
      description: "Show external packages. Base on go.mod.",
      onClick: () => setParams({ ...params, displayExt: !params.displayExt }),
    },
    {
      text: "Std",
      description: "Show standard library packages of Go.",
      getter: params.displayStd,
      onClick: () => setParams({ ...params, displayStd: !params.displayStd }),
    },
    {
      text: "Failed",
      getter: params.displayErr,
      description:
        "Show packages with parse errors.\nSee errors in the console.",
      onClick: () => setParams({ ...params, displayErr: !params.displayErr }),
    },
  ];

  return (
    <>
      <Panel position="top-left">
        <Selected
          selectedNode={selectedNode}
          params={params}
          setParams={setParams}
          setSelectedNode={setSelectedNode}
          setHoveredNode={setHoveredNode}
        />
      </Panel>
      <Panel position="top-right">
        <div className="gopkgview-mode">
          {controlModeBtn.map((btn, i) => (
            <ControlButton key={i} {...btn} />
          ))}
        </div>
        {hoveredNode && (
          <div className="gopkgview-hovered">
            {hoveredNode.id === "." ? "This is a root" : hoveredNode.id}
          </div>
        )}
      </Panel>
    </>
  );
}
