import { IconRotate } from "./IconRotate"
import "./welcome_scene.scss"
import { StandardDistributionGraph } from "../../components/StandardDistributionGraph"

export const WeclomeScene = () => {
  return (
    <div id="welcome_scene_main_div">
      <h1>WIP Welcome Screen</h1>
      <h3>Select Grids from Sidebar</h3>
      <StandardDistributionGraph 
        mean={0}
        standardDeviation={2}
        spanInDeviations={10}
        fidelity={200}
        xLabel="bones"
      />
      {/*<div id="dribble_container">
        <div id="tractor">
          <div className="wheels"/>
          <div className="chassy"/>
          <div className="control_box"/>
          <div className="arm" id="arm_segment_one">
            <div className="arm" id="arm_segment_two"/>
          </div>
        </div>
        <div id="building">
          <div className="building_element" id="building_element_first">
            <div className="window_grid">
              {[...Array(8)].map(ele => <div className="window"/>)}
            </div>
          </div>
          <div className="building_element" id="building_element_second"></div>
        </div>
        <div id="crane">
          <div className="crane_segment" id="crane_segment_one">
            {[...Array(9)].map(ele => <div className="lattice">&#9650;</div>)}
            <div className="crane_segment" id="crane_segment_two">
              {[...Array(5)].map(ele => <div className="lattice">&#9650;</div>)}
              <div className="crane_segment" id="crane_segment_three">
                {[...Array(5)].map(ele => <div className="lattice">&#9650;</div>)}
              </div>
            </div>
          </div>
        </div>
      </div>*/}
    </div>  
  )
}