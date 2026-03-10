import { GetGridFromProblemExampleQuery, Exact, InputMaybe, GetLinkedListFromProblemExampleQuery} from "../../../__generated__/resolvers-types";
import { QueryResult } from "@apollo/client";

export interface WithBasicClientProviderProps {
  animationOn: boolean,
  play: () => void,
  pause: () => void,
  animationSpeed: number,
  problemNumber: number,
}

interface WithBasicClientInjectedProps<T> extends WithBasicClientProviderProps {
  client: QueryResult<T, Exact<{
    number?: InputMaybe<number> | undefined;
    example?: InputMaybe<number> | undefined;
  }>>
  setup: () => Promise<void>
  setComplete: (b: boolean) => void
  complete: boolean
}

export interface WithBasicLinkedListClientInjectedProps extends WithBasicClientInjectedProps<GetLinkedListFromProblemExampleQuery> {}

export interface WithBasicGridClientInjectedProps extends WithBasicClientInjectedProps<GetGridFromProblemExampleQuery> {}


