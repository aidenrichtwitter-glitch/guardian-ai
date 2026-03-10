import { WithBasicGridClientInjectedProps } from "../../clientHOCProps";
import { WithBasicGridClient } from "../WithBasicGridClient"

const TEMPLATE_MinimumOperationsToMakeAUniValueGridController = ({
  animationOn, play, pause, animationSpeed,
  client, setup, problemNumber
}: WithBasicGridClientInjectedProps ) => {

  const clickSetup = () => {
    setup();
  }


  return <div></div>

}

export const MinimumOperationsToMakeAUniValueGridController = 
  WithBasicGridClient(TEMPLATE_MinimumOperationsToMakeAUniValueGridController, "Minimum Ops Grid");