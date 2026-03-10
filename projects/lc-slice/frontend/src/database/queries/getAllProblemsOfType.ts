import { GET_ALL_GRID_PROBLEMS } from "./getAllGridProblems";
import { GET_ALL_LINKED_LIST_PROBLEMS } from "./getAllLinkedListProblems";

export const GET_ALL_PROBLEMS_OF_TYPE = (datatype: "GRID" | "LINKED_LIST") => {
  switch(datatype) {
    case "GRID": {
      return GET_ALL_GRID_PROBLEMS;
    } break;
    case "LINKED_LIST": {
      return GET_ALL_LINKED_LIST_PROBLEMS;
    } break;
  }
}