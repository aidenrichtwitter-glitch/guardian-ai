import React from "react"
import { QueryResult } from "@apollo/client";
import { Exact, InputMaybe, GetLinkedListFromProblemExampleQuery, useGetLinkedListFromProblemExampleLazyQuery, LinkStatusEnum} from "../../../../__generated__/resolvers-types";
import { ComponentType, useState, useEffect} from "react";
import { useAppDispatch } from "../../../../features/hooks";
import { clearState } from "../../../../utils/clearState";
import { WithBasicClientProviderProps, WithBasicLinkedListClientInjectedProps } from "../clientHOCProps";
import { copyLinkedList } from "../../../../features/sharedActions";

export const WithBasicLinkedListClient = <T,>(
  WrappedComponent: ComponentType<WithBasicLinkedListClientInjectedProps>,
) => {
  return (props: WithBasicClientProviderProps) => {
    const dispatch = useAppDispatch();
    const [getList, listClient] = useGetLinkedListFromProblemExampleLazyQuery(); 
    const [example, setExample] = useState<number>(0);
    const [complete, setCompleteTemplate] = useState<boolean>(false);

    const setComplete = (b: boolean) => {
      setCompleteTemplate(b)
    }

    const clickSetUp = async () => {
      props.pause();
      clearState(dispatch, props.problemNumber);
      await getList({
        variables: {
          number: props.problemNumber,
          example: example,
        }
      })
    }

    useEffect(() => {
      if (listClient.data && listClient.data.problem && listClient.data.problem.linkedLists && listClient.data.problem.linkedLists[0]) {
        const {linkStatus, listId, listData} = listClient.data.problem.linkedLists[0];
        dispatch(copyLinkedList({listData: listData as number[], linkStatus: linkStatus as LinkStatusEnum}))
        setExample((example + 1) % listClient.data.problem.numExamples);
        setCompleteTemplate(false);
      }
    }, [listClient]);

    return (
      <WrappedComponent {...props} 
        setup={clickSetUp} 
        setComplete={setComplete}
        complete={complete}
        client={listClient}
      />
    );
  } 
}