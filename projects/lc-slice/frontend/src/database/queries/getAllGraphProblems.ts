import { gql } from "@apollo/client";

export const GET_ALL_GRAPH_PROBLEMS = gql`
  query GetAllGraphProblems {
    graphProblems {
      title
      problemNumber
      description
      problemId
    }
  }
`;