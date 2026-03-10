import { addNode } from "../../../../features/graphs/graphsSlice";
import { useAppDispatch, useAppSelector } from "../../../../features/hooks"
import { clearLog } from "../../../../features/problemInfo/problemSlice";
import { addGraph, deleteAllStructs } from "../../../../features/sharedActions";
import { BasicController } from "../BasicController";
import { ANIMATION_PROPS } from "../controllerUtils";
import { WithBasicGridClient } from "../GridControllers/WithBasicGridClient";

export const AllPathsFromSourceToTargetController = ({
    animationOn, animationSpeed, play, pause,
}: ANIMATION_PROPS) => {
    const dispatch = useAppDispatch();
    const graph = useAppSelector(state => state.graphs[0]);

    const setup = () => {
        dispatch(deleteAllStructs());
        dispatch(clearLog());
        dispatch(addGraph({nodeRadius: 30}));
        dispatch(addNode({graphIndex: 0, data: 0, initX: 200, initY: 200, links: [1]}));
        dispatch(addNode({graphIndex: 0, data: 1, initX: 400, initY: 200, links: [2]}));
        dispatch(addNode({graphIndex: 0, data: 2, initX: 400, initY: 400, links: [3]}));
        dispatch(addNode({graphIndex: 0, data: 3, initX: 200, initY: 400, links: [0]}));
    }

    const step = () => {
        console.log("step");
    }

    return (
        <BasicController problemNumber={1}
            setup={setup}
            play={play}
            pause={pause}
            step={step}
            label={"All Paths From Source to Target"}
        />
    )
}

//Perhaps create a generalized client for multiple data structures.
//TODO: Right now we are taking the grid client instead of the graph client
