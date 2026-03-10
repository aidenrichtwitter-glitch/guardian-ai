import { gql } from "@apollo/client";

export const GET_ALL_GRID_PROBLEMS = gql`
  query GetAllGridProblems {
    gridProblems {
      title
      problemNumber
      description
      problemId
    }
  }
`;
