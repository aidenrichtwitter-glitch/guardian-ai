import { gql } from "@apollo/client";

export const GET_ALL_ARRAY_PROBLEMS = gql`
  query GetAllArrayProblems {
    arrayProblems {
      title
      problemNumber
      description
      problemId
    }
  }
`;