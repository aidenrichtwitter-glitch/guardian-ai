import { useAppDispatch } from "../../features/hooks";
import { SelectorAccordian } from "./SelectorAccordian";
import { GridsSelectorNoData } from "./SelectorNoData";
import { withSelectorScene, WithSelectorSceneInjectedProps} from "./withSelectorScene";

const GridsSelectorSceneTemplate = ({theme, colors, matches, clientQuery}: WithSelectorSceneInjectedProps) => {
  const {loading, error, data, refetch, networkStatus} = clientQuery();
  const dispatch = useAppDispatch();
  if (loading && !data) {
    return (<div>Loading!</div>)
  }
  if (error) {
    return (<div>Error!</div>)
  }
  return (
    <div>
      {data.gridProblems.map((problem, idx) => {
        if (problem) {
          return (
            <SelectorAccordian 
              key={`Grids_Selector_Accordion${problem.problemId}`}
              title={problem.title}
              description={problem.description}
              problemId={problem.problemId}
              problemNumber={problem.problemNumber}
            />
          );
        } else {
          return null;
        }
      })}
    </div>
  );
};

const LinkedListsSelectorSceneTemplate = ({theme, colors, matches, clientQuery}: WithSelectorSceneInjectedProps) => {
  const {loading, error, data, refetch, networkStatus} = clientQuery();
  if (loading && !data) {
    return (<div>Loading!</div>)
  }
  if (error) {
    return (<div>Error!</div>)
  }
  return (
    <div>
      {data.linkedListProblems.map((problem, idx) => {
        if (problem) {
          return (
            <SelectorAccordian 
              key={`Linked_List_Selector_Accordion${problem.problemId}`}
              title={problem.title}
              description={problem.description}
              problemId={problem.problemId}
              problemNumber={problem.problemNumber}
            />
          );
        } else {
          return null;
        }
      })}
    </div>
  );
};

const GraphsSelectorSceneTemplate = ({theme, colors, matches, clientQuery}: WithSelectorSceneInjectedProps) => {
  const {loading, error, data, refetch, networkStatus} = clientQuery();
  const dispatch = useAppDispatch();

  if (loading && !data) {
    return (<div>Loading!</div>)
  }
  if (error) {
    return (<div>Error!</div>)
  }

  return (
    <div>
    {data.graphProblems.map((problem, idx) => {
      if (problem) {
        return (
          <SelectorAccordian 
            key={`Graphs_Selector_Accordion${problem.problemId}`}
            title={problem.title}
            description={problem.description}
            problemId={problem.problemId}
            problemNumber={problem.problemNumber}
          />
        );
      } else {
        return null;
      }
    })}
    </div>
  );
};

export const GraphsSelectorScene = withSelectorScene(GraphsSelectorSceneTemplate, "GRAPH");
export const GridsSelectorScene = withSelectorScene(GridsSelectorSceneTemplate, "GRID");
export const LinkedListsSelectorScene = withSelectorScene(LinkedListsSelectorSceneTemplate, "LINKED_LIST");