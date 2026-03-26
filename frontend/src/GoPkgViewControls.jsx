import React from "react";
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

  const isHidden = params.hiddenPackages.includes(selectedNode.id);

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
        <div
          onClick={() => {
            const hiddenSet = new Set(params.hiddenPackages);
            if (hiddenSet.has(selectedNode.id)) {
              hiddenSet.delete(selectedNode.id);
            } else {
              hiddenSet.add(selectedNode.id);
            }
            setParams({ ...params, hiddenPackages: [...hiddenSet] });
            setSelectedNode(null);
          }}
          className={isHidden ? "gopkgview-btn" : "gopkgview-btn gopkgview-btn-active"}
          title="Hide/unhide currently selected package"
        >
          {isHidden ? "Unhide selected" : "Hide selected"}
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
  allPackages,
}) {
  const [packageFilter, setPackageFilter] = React.useState("");
  
  const clearHiddenPackages = () => setParams({ ...params, hiddenPackages: [] });

  const togglePackageHidden = (pkg) => {
    const hiddenSet = new Set(params.hiddenPackages);
    if (hiddenSet.has(pkg)) {
      hiddenSet.delete(pkg);
    } else {
      hiddenSet.add(pkg);
    }
    setParams({ ...params, hiddenPackages: [...hiddenSet] });
  };

  const filteredPackageList = (allPackages || [])
    .filter((pkg) =>
      pkg.toLowerCase().includes(packageFilter.trim().toLowerCase())
    )
    .sort((a, b) => a.localeCompare(b));

  const hiddenCount = params.hiddenPackages.length;
  const totalCount = allPackages ? allPackages.length : 0;

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

        <div className="gopkgview-hide-panel">
          <div className="gopkgview-hide-panel-header">
            <span>Hide package filter</span>
            <button className="gopkgview-btn" onClick={clearHiddenPackages}>
              Clear ({hiddenCount}/{totalCount})
            </button>
          </div>
          <input
            className="gopkgview-hide-filter"
            type="text"
            value={packageFilter}
            placeholder="Search package to hide..."
            onChange={(e) => setPackageFilter(e.target.value)}
          />
          <div className="gopkgview-hide-list">
            {filteredPackageList.length === 0 ? (
              <div className="gopkgview-hide-empty">No packages</div>
            ) : (
              filteredPackageList.map((pkg) => (
                <label key={pkg} className="gopkgview-hide-item">
                  <input
                    type="checkbox"
                    checked={params.hiddenPackages.includes(pkg)}
                    onChange={() => togglePackageHidden(pkg)}
                  />
                  <span>{pkg}</span>
                </label>
              ))
            )}
          </div>
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
