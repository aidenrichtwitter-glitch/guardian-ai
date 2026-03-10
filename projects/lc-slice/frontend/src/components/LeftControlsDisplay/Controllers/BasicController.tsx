import "./controller.css"
import { FormEvent } from "react"

type BasicControllerButtonOverrideProps = {
  buttonLabels: string[],
  buttonActions: (() => void)[]
}

type BasicControllerInputOverrideProps = Required<Pick<BasicControllerProps, "exInputs">>

type BasicControllerProps = {
  label: string,
  setup: () => void,
  step: () => void,
  pause: () => void,
  play: () => void,
  problemNumber: number,
  exButtons?: {
    labels: string[]
    actions: (() => void)[],
  }
  exInputs?: {
    labels: string[],
    values: number[],
    actions: ((e: FormEvent<HTMLInputElement>) => void)[],
    min: number,
    max: number,
  }
}

export const BasicController = ({
  label, setup, step, pause, play,
  exButtons, exInputs
}: BasicControllerProps) => {
  const basicPlay = () => {

  }
  return (
    <div className={"controller"}>
      <div className={"controller_contents_container"}>
        <b>{label}</b>
        <ControllerButtons 
          buttonLabels={["Set Up", "Step", "Pause", "Play"]}
          buttonActions={[setup, step, pause, play]}
        />
        {exButtons ? 
          <ControllerButtons 
            buttonLabels={exButtons.labels} 
            buttonActions={exButtons.actions}
          /> : 
          null 
        }
        {exInputs ? <ControllerInputs exInputs={exInputs}/> : null}
      </div>
    </div>     
  ) 
}

export const ControllerButtons = ({buttonLabels, buttonActions} : BasicControllerButtonOverrideProps) => {
  return (
    <div className={"controller_buttons_container"}>
      {buttonActions.map((action, idx) => (
        <button key={idx} className={"controller_button"} onClick={() => action()}>{buttonLabels[idx]}</button>
      ))}
    </div>
  )
}

export const ControllerInputs = ({exInputs}: BasicControllerInputOverrideProps) => {
  const {labels, actions, min, max, values} = exInputs;
  return (
    <div className={"controller_buttons_container"}>
      {actions.map( ( action, idx ) => (
        <div>
          {labels[idx] ? labels[idx] : "Input: "}
          <input 
            type="number"
            min={min}
            max={max}
            step={1}
            onChange={action}
            value={values[idx]}
            key={labels[idx] ? labels[idx] : idx}
            className={"controller_button"}
            style={{"marginLeft": "5px", "width": "40px", "marginRight": "5px"}}
          />
        </div> 
      ))}  
    </div>  
  );        
}
