import { Panel } from "@xyflow/react";
import "./controls.css";

function ControlButton({ text, getter, onClick, description }) {
  const activeClass = getter ? `gopkgview-mode-btn-active` : "";

  return (
    <div
      title={description}
      onClick={onClick}
      className={`gopkgview-mode-btn ${activeClass}`}
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
  );
}

export default function Controls({
  params,
  setParams,
  setHoveredNode,
  setSelectedNode,
  selectedNode,
}) {
  const controlModeBtn = [
    {
      text: "Std",
      description: "Show standard library packages of Go.",
      getter: params.displayStd,
      onClick: () => setParams({ ...params, displayStd: !params.displayStd }),
    },
    {
      text: "External",
      getter: params.displayExt,
      description: "Show external packages. Base on go.mod.",
      onClick: () => setParams({ ...params, displayExt: !params.displayExt }),
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
      </Panel>
    </>
  );
}
