// #region Imports
import React, {useState} from "react"
import {useAppSelector } from "../../../features/hooks";
import { CreateProblemController } from "./CreateProblemController";
import { UtilitiesController } from "../Controllers/UtilitiesController";
//#endregion


export const Controls = () => {
    const [animationOn, setAnimationOn] = useState<boolean>(false);
    const [animationSpeed, setAnimationSpeed] = useState<number>(500);

    const problemLog = useAppSelector(state => state.problem.problemLog);
    const problemNumber = useAppSelector(state => state.problem.problemNumber);

    const onChangeAnimationSpeed = (e: React.FormEvent<HTMLInputElement>) => {
        const numVal = parseInt(e.currentTarget.value);
        setAnimationSpeed(numVal);
    }

    const switchAnimationOn = () => {
        setAnimationOn(!animationOn);
    }

    const play = () => {
        if (!animationOn) {
            setAnimationOn(true);
        }
    }

    const pause = () => {
        if (animationOn) {
            setAnimationOn(false);
        }
    }

    return (
      <div style={{"display": "flex", "flexDirection": "column"}}>
        <div className="controls_container">
          {/*<UtilitiesController inputGrid={0} selectedRow={0} clearValue={0}/> */}
          <CreateProblemController 
            problemNumber={problemNumber}
            animationOn={animationOn}
            play={play}
            pause={pause}
            animationSpeed={animationSpeed}
          />
          <br></br>
          <div style={{display: "flex", flexDirection: "row", "justifyContent": "flex-start", marginLeft: "10px"}}>
            {"Animation Speed: "}
            <input
              type="number"
              min={50}
              max={1000}
              step={50}
              onChange={onChangeAnimationSpeed}
              value={animationSpeed}
            />
          </div>
        </div>
        <hr style={{width: "100%"}}></hr>
        <div 
          className="action_log" 
          style={{"display": "flex", "flexDirection": "column", "alignItems": "center"}}>
            <h3 style={{marginTop: "5px"}}>Action Log</h3>
            {problemLog.map( (ele, idx) => {
              return (
                <div key={`PROBLEM_LOG_${idx}`}>
                    {ele}
                </div>
              );
            })}
        </div>
    </div>
    );
}
