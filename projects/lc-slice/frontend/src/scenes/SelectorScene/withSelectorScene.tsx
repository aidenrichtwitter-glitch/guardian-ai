import React, { useLayoutEffect, useRef } from "react"
import { QueryResult } from "@apollo/client";
import { ComponentType, useState, useEffect} from "react";
import { ColorTokenType, tokens } from "../../theme";
import { useMediaQuery, useTheme, Theme} from "@mui/material";
import { GraphsSelectorNoData, GridsSelectorNoData, LinkedListsSelectorNoData } from "./SelectorNoData";
import { useGetAllArrayProblemsQuery, useGetAllGraphProblemsQuery, useGetAllGridProblemsQuery, useGetAllLinkedListProblemsQuery } from "../../__generated__/resolvers-types";

import gsap from "gsap";


const getClientQuery = (datatype: "GRAPH" | "GRID" | "ARRAY" | "LINKED_LIST" | "HASH_TABLE") => {
  switch(datatype) {
    case "GRID": {
      return useGetAllGridProblemsQuery
    } break;
    case "GRAPH": {
      return useGetAllGraphProblemsQuery;
    } break;
    case "LINKED_LIST": {
      return useGetAllLinkedListProblemsQuery;
    } break;
    default: {
      return useGetAllArrayProblemsQuery;
    } break;
  }
}

interface WithSelectorSceneProviderProps {
  datatype: "GRAPH" | "GRID" | "ARRAY" | "LINKED_LIST" | "HASH_TABLE"
}

export interface WithSelectorSceneInjectedProps {
  theme: Theme,
  colors: ColorTokenType,
  matches: boolean,
  clientQuery: typeof useGetAllGridProblemsQuery | typeof useGetAllGraphProblemsQuery | typeof useGetAllArrayProblemsQuery
}

export const withSelectorScene = (
  WrappedComponent: ComponentType<WithSelectorSceneInjectedProps>,
  datatype: "GRAPH" | "GRID" | "ARRAY" | "LINKED_LIST" | "HASH_TABLE"
) => {
  return (props: WithSelectorSceneProviderProps) => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const baseRef = useRef<HTMLDivElement>(null);
    const timeline = useRef();
    const matches = useMediaQuery(theme.breakpoints.up("md"));
    const clientQuery = getClientQuery(datatype);

    useLayoutEffect(() => {
      gsap.context(() => {
        timeline.current = gsap.timeline().from(".selector_accordion", {opacity: 0, scaleX: 0.5})
      }, [baseRef])
    }, [])


    switch(datatype) {
      case "GRID": {
        return (
          <div ref={baseRef}>
          <GridsSelectorNoData>
            <WrappedComponent theme={theme} colors={colors} matches={matches} clientQuery={clientQuery}/>
          </GridsSelectorNoData>
          </div>
        );
      } break;
      case "GRAPH": {
        return (
          <div ref={baseRef}>
          <GraphsSelectorNoData>
            <WrappedComponent theme={theme} colors={colors} matches={matches} clientQuery={clientQuery}/>
          </GraphsSelectorNoData>
          </div>
        )
      } break;
      default: {
        return (
          <div ref={baseRef}>
          <LinkedListsSelectorNoData>
            <WrappedComponent theme={theme} colors={colors} matches={matches} clientQuery={clientQuery}/>
          </LinkedListsSelectorNoData>
          </div>
        );
      } break;
    }
  } 
}