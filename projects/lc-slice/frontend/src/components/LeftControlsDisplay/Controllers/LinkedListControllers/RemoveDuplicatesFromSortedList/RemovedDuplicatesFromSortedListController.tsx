import React, {useState, useEffect} from "react"
import { useAppDispatch, useAppSelector } from "../../../../../features/hooks";
import { QUESTIONS_ENUM } from "../../../../../utils/questionEnum";
import { BasicController } from "../../BasicController";
import { WithBasicLinkedListClient } from "../WithBasicLinkedListClient";
import { WithBasicLinkedListClientInjectedProps } from "../../clientHOCProps";

const TEMPLATE_RemoveDuplicatesFromSortedListController = ({
  animationOn, play, pause, animationSpeed,
  setComplete, complete, problemNumber, setup,
}: WithBasicLinkedListClientInjectedProps) => {
  /* Global State Variables */
  const listData = useAppSelector(state => state.linkedLists[0] ? state.linkedLists[0].listData : [4, 3, 2, 1, 0]);

  const clickSetUp = async () => {
    setup();
  }

  const clickStep = () => {
    console.log("step");
  }

  useEffect(() => {
    if (animationOn && problemNumber === QUESTIONS_ENUM.UNIQUE_PATHS) {
      setTimeout(() => clickStep(), animationSpeed);
    }
  }, [animationOn]);


  return (
    <div>
      <BasicController problemNumber={problemNumber} play={() => {
          if (problemNumber !== QUESTIONS_ENUM.UNIQUE_PATHS) {
              clickSetUp();
          }
          play();
        }} 
        label={"Remove Duplicates from Sorted List I"} setup={clickSetUp} step={clickStep} pause={pause} 
      />
    </div>
  )
}

export const RemoveDuplicatesFromSortedListController = WithBasicLinkedListClient(TEMPLATE_RemoveDuplicatesFromSortedListController);