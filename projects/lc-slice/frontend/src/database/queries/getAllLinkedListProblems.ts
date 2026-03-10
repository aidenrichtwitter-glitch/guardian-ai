import { gql } from "@apollo/client";

export const GET_ALL_LINKED_LIST_PROBLEMS = gql`
  query GetAllLinkedListProblems {
    linkedListProblems {
      title
      problemNumber
      description
      problemId
    }
  }
`;