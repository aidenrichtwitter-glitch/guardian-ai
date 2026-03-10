import { GetGridFromProblemExampleQuery} from "../../../../__generated__/resolvers-types";
import { ComponentType, useState, useEffect} from "react";
import { useAppDispatch } from "../../../../features/hooks";
import { useGetGridFromProblemExampleLazyQuery } from "../../../../__generated__/resolvers-types";
import { clearState } from "../../../../utils/clearState";
import { convertArrayToGrid} from "./gridControllerUtils";
import { copyGrids } from "../../../../features/grids/gridsSlice";
import { GridCreationLog } from "./logUtils";
import { pushJSXToLog } from "../../../../features/problemInfo/problemSlice";
import { WithBasicClientProviderProps, WithBasicGridClientInjectedProps } from "../clientHOCProps";

export const WithBasicGridClient = (
  WrappedComponent: ComponentType<WithBasicGridClientInjectedProps>,
  gridLabel: string,
  setUpOnly = false,
) => {
  if (setUpOnly) {
    return (props: WithBasicClientProviderProps) => {
      const dispatch = useAppDispatch();
      const [getGrid, gridClient] = useGetGridFromProblemExampleLazyQuery(); 
      const [example, setExample] = useState<number>(0);
      const [complete, setCompleteTemplate] = useState<boolean>(false);
  
      const setComplete = (b: boolean) => {
        setCompleteTemplate(b)
      }
  
      const clickSetUp = async () => {
        props.pause();
        clearState(dispatch, props.problemNumber);
        await getGrid({
          variables: {
            number: props.problemNumber,
            example: example,
          }
        })
      }

      useEffect(() => {
        if (gridClient.data && gridClient.data.problem && gridClient.data.problem.grids && gridClient.data.problem.grids[0]) {
          setExample((example + 1) % gridClient.data.problem.numExamples);
          setCompleteTemplate(false);
        }
      }, [gridClient])

      return (
        <WrappedComponent {...props} 
          setup={clickSetUp} 
          setComplete={setComplete}
          complete={complete}
          client={gridClient}
        />
      );
    }
  }

  return (props: WithBasicClientProviderProps) => {
    const dispatch = useAppDispatch();
    const [getGrid, gridClient] = useGetGridFromProblemExampleLazyQuery(); 
    const [example, setExample] = useState<number>(0);
    const [complete, setCompleteTemplate] = useState<boolean>(false);

    const setComplete = (b: boolean) => {
      setCompleteTemplate(b)
    }

    const clickSetUp = async () => {
      props.pause();
      clearState(dispatch, props.problemNumber);
      await getGrid({
        variables: {
          number: props.problemNumber,
          example: example,
        }
      })
    }

    useEffect(() => {
      if (gridClient.data && gridClient.data.problem && gridClient.data.problem.grids && gridClient.data.problem.grids[0]) {
        const {interpretAs, gridData} = gridClient.data.problem.grids[0];
        //TODO: This is also bad
        const grid = convertArrayToGrid(gridData as number[][], interpretAs as "NUMBER" | "BOOLEAN" | "NORMALIZED");
        dispatch(copyGrids([grid]));
        setExample((example + 1) % gridClient.data.problem.numExamples);
        const element = (
          <GridCreationLog
            dispatch={dispatch}
            numStructs={1}
            labels={[gridLabel]}
          />
        );
        dispatch(pushJSXToLog({element: element}));
        setCompleteTemplate(false);
      }
    }, [gridClient])

    return (
      <WrappedComponent {...props} 
        setup={clickSetUp} 
        setComplete={setComplete}
        complete={complete}
        client={gridClient}
      />
    );
  } 
}