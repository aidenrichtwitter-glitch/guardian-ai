import { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import { gql } from '@apollo/client';
import * as Apollo from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
const defaultOptions = {} as const;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  EmailAddress: string;
  NonNegativeInt: number;
  PositiveFloat: number;
  PositiveInt: number;
  UUID: string;
};

export type AddArrayTypeInput = {
  data: Array<InputMaybe<Scalars['Int']>>;
  example?: InputMaybe<Scalars['NonNegativeInt']>;
  interpretAs?: InputMaybe<ArrayInterpreter>;
  label?: InputMaybe<Scalars['String']>;
  problemNumber: Scalars['PositiveInt'];
};

export type AddGridInput = {
  data: Array<InputMaybe<Array<InputMaybe<Scalars['Int']>>>>;
  example?: InputMaybe<Scalars['NonNegativeInt']>;
  interpretAs?: InputMaybe<GridInterpreter>;
  label?: InputMaybe<Scalars['String']>;
  problemNumber: Scalars['PositiveInt'];
};

export type AddLinkedListTypeInput = {
  data: Array<InputMaybe<Scalars['Int']>>;
  example?: InputMaybe<Scalars['NonNegativeInt']>;
  label?: InputMaybe<Scalars['String']>;
  linkStatus?: InputMaybe<LinkStatusEnum>;
  problemNumber: Scalars['PositiveInt'];
};

export type AddProblemInput = {
  description?: InputMaybe<Scalars['String']>;
  problemNumber: Scalars['PositiveInt'];
  title: Scalars['String'];
};

export enum ArrayInterpreter {
  Alphabet = 'ALPHABET',
  Boolean = 'BOOLEAN',
  Normalized = 'NORMALIZED',
  Number = 'NUMBER'
}

export type ArrayType = {
  __typename?: 'ArrayType';
  arrayData?: Maybe<Array<Maybe<Scalars['Int']>>>;
  arrayId: Scalars['ID'];
  exampleIndex: Scalars['NonNegativeInt'];
  fromExample: Scalars['NonNegativeInt'];
  interpretAs: Scalars['String'];
  label?: Maybe<Scalars['String']>;
  problemNumber: Scalars['PositiveInt'];
};

export type Example = {
  __typename?: 'Example';
  grids?: Maybe<Array<Maybe<Grid>>>;
};

export type Grid = {
  __typename?: 'Grid';
  exampleIndex: Scalars['NonNegativeInt'];
  fromExample: Scalars['NonNegativeInt'];
  gridData?: Maybe<Array<Maybe<Array<Maybe<Scalars['Int']>>>>>;
  gridId: Scalars['ID'];
  height: Scalars['PositiveInt'];
  interpretAs: Scalars['String'];
  label?: Maybe<Scalars['String']>;
  problemNumber: Scalars['PositiveInt'];
  width: Scalars['PositiveInt'];
};

export enum GridInterpreter {
  Alphabet = 'ALPHABET',
  Boolean = 'BOOLEAN',
  Normalized = 'NORMALIZED',
  Number = 'NUMBER'
}

export enum LinkStatusEnum {
  BackLinked = 'BACK_LINKED',
  DoublyLinked = 'DOUBLY_LINKED',
  ForwardLinked = 'FORWARD_LINKED',
  Unlinked = 'UNLINKED'
}

export type LinkedListType = {
  __typename?: 'LinkedListType';
  exampleIndex: Scalars['NonNegativeInt'];
  fromExample: Scalars['NonNegativeInt'];
  label?: Maybe<Scalars['String']>;
  length: Scalars['PositiveInt'];
  linkStatus?: Maybe<LinkStatusEnum>;
  listData?: Maybe<Array<Maybe<Scalars['Int']>>>;
  listId: Scalars['ID'];
  problemNumber: Scalars['PositiveInt'];
};

export type Mutation = {
  __typename?: 'Mutation';
  addArray?: Maybe<ArrayType>;
  addGrid?: Maybe<Grid>;
  addLinkedList?: Maybe<LinkedListType>;
  addProblem?: Maybe<ProblemInfo>;
  updateDescription?: Maybe<Scalars['String']>;
  updateTitle?: Maybe<Scalars['String']>;
};


export type MutationAddArrayArgs = {
  input: AddArrayTypeInput;
};


export type MutationAddGridArgs = {
  input: AddGridInput;
};


export type MutationAddLinkedListArgs = {
  input: AddLinkedListTypeInput;
};


export type MutationAddProblemArgs = {
  input: AddProblemInput;
};


export type MutationUpdateDescriptionArgs = {
  input: UpdateDescriptionInput;
};


export type MutationUpdateTitleArgs = {
  input: UpdateTitleInput;
};

export type ProblemInfo = {
  __typename?: 'ProblemInfo';
  arrays?: Maybe<Array<Maybe<ArrayType>>>;
  description: Scalars['String'];
  grids?: Maybe<Array<Maybe<Grid>>>;
  linkedLists?: Maybe<Array<Maybe<LinkedListType>>>;
  numExamples: Scalars['NonNegativeInt'];
  problemId: Scalars['UUID'];
  problemNumber: Scalars['PositiveInt'];
  title: Scalars['String'];
};


export type ProblemInfoArraysArgs = {
  example?: InputMaybe<Scalars['NonNegativeInt']>;
};


export type ProblemInfoGridsArgs = {
  example?: InputMaybe<Scalars['NonNegativeInt']>;
};


export type ProblemInfoLinkedListsArgs = {
  example?: InputMaybe<Scalars['NonNegativeInt']>;
};

export type Query = {
  __typename?: 'Query';
  arrayProblems?: Maybe<Array<Maybe<ProblemInfo>>>;
  arrays?: Maybe<Array<Maybe<ArrayType>>>;
  graphProblems?: Maybe<Array<Maybe<ProblemInfo>>>;
  gridProblems?: Maybe<Array<Maybe<ProblemInfo>>>;
  grids?: Maybe<Array<Maybe<Grid>>>;
  linkedListProblems?: Maybe<Array<Maybe<ProblemInfo>>>;
  linkedLists?: Maybe<Array<Maybe<LinkedListType>>>;
  problem?: Maybe<ProblemInfo>;
};


export type QueryGridProblemsArgs = {
  skip?: InputMaybe<Scalars['Int']>;
  take?: InputMaybe<Scalars['Int']>;
};


export type QueryProblemArgs = {
  number?: InputMaybe<Scalars['Int']>;
};

export type UpdateDescriptionInput = {
  newDescription: Scalars['String'];
  problemNumber: Scalars['PositiveInt'];
};

export type UpdateTitleInput = {
  newTitle: Scalars['String'];
  problemNumber: Scalars['PositiveInt'];
};

export enum ValidTypes {
  Array = 'ARRAY',
  Graph = 'GRAPH',
  Grid = 'GRID'
}



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  AddArrayTypeInput: AddArrayTypeInput;
  AddGridInput: AddGridInput;
  AddLinkedListTypeInput: AddLinkedListTypeInput;
  AddProblemInput: AddProblemInput;
  ArrayInterpreter: ArrayInterpreter;
  ArrayType: ResolverTypeWrapper<ArrayType>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']>;
  EmailAddress: ResolverTypeWrapper<Scalars['EmailAddress']>;
  Example: ResolverTypeWrapper<Example>;
  Grid: ResolverTypeWrapper<Grid>;
  GridInterpreter: GridInterpreter;
  ID: ResolverTypeWrapper<Scalars['ID']>;
  Int: ResolverTypeWrapper<Scalars['Int']>;
  LinkStatusEnum: LinkStatusEnum;
  LinkedListType: ResolverTypeWrapper<LinkedListType>;
  Mutation: ResolverTypeWrapper<{}>;
  NonNegativeInt: ResolverTypeWrapper<Scalars['NonNegativeInt']>;
  PositiveFloat: ResolverTypeWrapper<Scalars['PositiveFloat']>;
  PositiveInt: ResolverTypeWrapper<Scalars['PositiveInt']>;
  ProblemInfo: ResolverTypeWrapper<ProblemInfo>;
  Query: ResolverTypeWrapper<{}>;
  String: ResolverTypeWrapper<Scalars['String']>;
  UUID: ResolverTypeWrapper<Scalars['UUID']>;
  UpdateDescriptionInput: UpdateDescriptionInput;
  UpdateTitleInput: UpdateTitleInput;
  ValidTypes: ValidTypes;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  AddArrayTypeInput: AddArrayTypeInput;
  AddGridInput: AddGridInput;
  AddLinkedListTypeInput: AddLinkedListTypeInput;
  AddProblemInput: AddProblemInput;
  ArrayType: ArrayType;
  Boolean: Scalars['Boolean'];
  EmailAddress: Scalars['EmailAddress'];
  Example: Example;
  Grid: Grid;
  ID: Scalars['ID'];
  Int: Scalars['Int'];
  LinkedListType: LinkedListType;
  Mutation: {};
  NonNegativeInt: Scalars['NonNegativeInt'];
  PositiveFloat: Scalars['PositiveFloat'];
  PositiveInt: Scalars['PositiveInt'];
  ProblemInfo: ProblemInfo;
  Query: {};
  String: Scalars['String'];
  UUID: Scalars['UUID'];
  UpdateDescriptionInput: UpdateDescriptionInput;
  UpdateTitleInput: UpdateTitleInput;
};

export type ArrayTypeResolvers<ContextType = any, ParentType extends ResolversParentTypes['ArrayType'] = ResolversParentTypes['ArrayType']> = {
  arrayData?: Resolver<Maybe<Array<Maybe<ResolversTypes['Int']>>>, ParentType, ContextType>;
  arrayId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  exampleIndex?: Resolver<ResolversTypes['NonNegativeInt'], ParentType, ContextType>;
  fromExample?: Resolver<ResolversTypes['NonNegativeInt'], ParentType, ContextType>;
  interpretAs?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  label?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  problemNumber?: Resolver<ResolversTypes['PositiveInt'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface EmailAddressScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['EmailAddress'], any> {
  name: 'EmailAddress';
}

export type ExampleResolvers<ContextType = any, ParentType extends ResolversParentTypes['Example'] = ResolversParentTypes['Example']> = {
  grids?: Resolver<Maybe<Array<Maybe<ResolversTypes['Grid']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GridResolvers<ContextType = any, ParentType extends ResolversParentTypes['Grid'] = ResolversParentTypes['Grid']> = {
  exampleIndex?: Resolver<ResolversTypes['NonNegativeInt'], ParentType, ContextType>;
  fromExample?: Resolver<ResolversTypes['NonNegativeInt'], ParentType, ContextType>;
  gridData?: Resolver<Maybe<Array<Maybe<Array<Maybe<ResolversTypes['Int']>>>>>, ParentType, ContextType>;
  gridId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  height?: Resolver<ResolversTypes['PositiveInt'], ParentType, ContextType>;
  interpretAs?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  label?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  problemNumber?: Resolver<ResolversTypes['PositiveInt'], ParentType, ContextType>;
  width?: Resolver<ResolversTypes['PositiveInt'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type LinkedListTypeResolvers<ContextType = any, ParentType extends ResolversParentTypes['LinkedListType'] = ResolversParentTypes['LinkedListType']> = {
  exampleIndex?: Resolver<ResolversTypes['NonNegativeInt'], ParentType, ContextType>;
  fromExample?: Resolver<ResolversTypes['NonNegativeInt'], ParentType, ContextType>;
  label?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  length?: Resolver<ResolversTypes['PositiveInt'], ParentType, ContextType>;
  linkStatus?: Resolver<Maybe<ResolversTypes['LinkStatusEnum']>, ParentType, ContextType>;
  listData?: Resolver<Maybe<Array<Maybe<ResolversTypes['Int']>>>, ParentType, ContextType>;
  listId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  problemNumber?: Resolver<ResolversTypes['PositiveInt'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MutationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  addArray?: Resolver<Maybe<ResolversTypes['ArrayType']>, ParentType, ContextType, RequireFields<MutationAddArrayArgs, 'input'>>;
  addGrid?: Resolver<Maybe<ResolversTypes['Grid']>, ParentType, ContextType, RequireFields<MutationAddGridArgs, 'input'>>;
  addLinkedList?: Resolver<Maybe<ResolversTypes['LinkedListType']>, ParentType, ContextType, RequireFields<MutationAddLinkedListArgs, 'input'>>;
  addProblem?: Resolver<Maybe<ResolversTypes['ProblemInfo']>, ParentType, ContextType, RequireFields<MutationAddProblemArgs, 'input'>>;
  updateDescription?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, RequireFields<MutationUpdateDescriptionArgs, 'input'>>;
  updateTitle?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, RequireFields<MutationUpdateTitleArgs, 'input'>>;
};

export interface NonNegativeIntScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['NonNegativeInt'], any> {
  name: 'NonNegativeInt';
}

export interface PositiveFloatScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['PositiveFloat'], any> {
  name: 'PositiveFloat';
}

export interface PositiveIntScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['PositiveInt'], any> {
  name: 'PositiveInt';
}

export type ProblemInfoResolvers<ContextType = any, ParentType extends ResolversParentTypes['ProblemInfo'] = ResolversParentTypes['ProblemInfo']> = {
  arrays?: Resolver<Maybe<Array<Maybe<ResolversTypes['ArrayType']>>>, ParentType, ContextType, Partial<ProblemInfoArraysArgs>>;
  description?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  grids?: Resolver<Maybe<Array<Maybe<ResolversTypes['Grid']>>>, ParentType, ContextType, Partial<ProblemInfoGridsArgs>>;
  linkedLists?: Resolver<Maybe<Array<Maybe<ResolversTypes['LinkedListType']>>>, ParentType, ContextType, Partial<ProblemInfoLinkedListsArgs>>;
  numExamples?: Resolver<ResolversTypes['NonNegativeInt'], ParentType, ContextType>;
  problemId?: Resolver<ResolversTypes['UUID'], ParentType, ContextType>;
  problemNumber?: Resolver<ResolversTypes['PositiveInt'], ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QueryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  arrayProblems?: Resolver<Maybe<Array<Maybe<ResolversTypes['ProblemInfo']>>>, ParentType, ContextType>;
  arrays?: Resolver<Maybe<Array<Maybe<ResolversTypes['ArrayType']>>>, ParentType, ContextType>;
  graphProblems?: Resolver<Maybe<Array<Maybe<ResolversTypes['ProblemInfo']>>>, ParentType, ContextType>;
  gridProblems?: Resolver<Maybe<Array<Maybe<ResolversTypes['ProblemInfo']>>>, ParentType, ContextType, Partial<QueryGridProblemsArgs>>;
  grids?: Resolver<Maybe<Array<Maybe<ResolversTypes['Grid']>>>, ParentType, ContextType>;
  linkedListProblems?: Resolver<Maybe<Array<Maybe<ResolversTypes['ProblemInfo']>>>, ParentType, ContextType>;
  linkedLists?: Resolver<Maybe<Array<Maybe<ResolversTypes['LinkedListType']>>>, ParentType, ContextType>;
  problem?: Resolver<Maybe<ResolversTypes['ProblemInfo']>, ParentType, ContextType, Partial<QueryProblemArgs>>;
};

export interface UuidScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['UUID'], any> {
  name: 'UUID';
}

export type Resolvers<ContextType = any> = {
  ArrayType?: ArrayTypeResolvers<ContextType>;
  EmailAddress?: GraphQLScalarType;
  Example?: ExampleResolvers<ContextType>;
  Grid?: GridResolvers<ContextType>;
  LinkedListType?: LinkedListTypeResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  NonNegativeInt?: GraphQLScalarType;
  PositiveFloat?: GraphQLScalarType;
  PositiveInt?: GraphQLScalarType;
  ProblemInfo?: ProblemInfoResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  UUID?: GraphQLScalarType;
};


export type GetAllArrayProblemsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAllArrayProblemsQuery = { __typename?: 'Query', arrayProblems?: Array<{ __typename?: 'ProblemInfo', title: string, problemNumber: number, description: string, problemId: string } | null> | null };

export type GetAllGraphProblemsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAllGraphProblemsQuery = { __typename?: 'Query', graphProblems?: Array<{ __typename?: 'ProblemInfo', title: string, problemNumber: number, description: string, problemId: string } | null> | null };

export type GetAllGridProblemsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAllGridProblemsQuery = { __typename?: 'Query', gridProblems?: Array<{ __typename?: 'ProblemInfo', title: string, problemNumber: number, description: string, problemId: string } | null> | null };

export type GetAllLinkedListProblemsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAllLinkedListProblemsQuery = { __typename?: 'Query', linkedListProblems?: Array<{ __typename?: 'ProblemInfo', title: string, problemNumber: number, description: string, problemId: string } | null> | null };

export type GetGridFromProblemExampleQueryVariables = Exact<{
  number?: InputMaybe<Scalars['Int']>;
  example?: InputMaybe<Scalars['NonNegativeInt']>;
}>;


export type GetGridFromProblemExampleQuery = { __typename?: 'Query', problem?: { __typename?: 'ProblemInfo', title: string, problemId: string, numExamples: number, grids?: Array<{ __typename?: 'Grid', gridId: string, gridData?: Array<Array<number | null> | null> | null, interpretAs: string, label?: string | null } | null> | null } | null };

export type GetLinkedListFromProblemExampleQueryVariables = Exact<{
  number?: InputMaybe<Scalars['Int']>;
  example?: InputMaybe<Scalars['NonNegativeInt']>;
}>;


export type GetLinkedListFromProblemExampleQuery = { __typename?: 'Query', problem?: { __typename?: 'ProblemInfo', title: string, problemId: string, numExamples: number, linkedLists?: Array<{ __typename?: 'LinkedListType', listId: string, listData?: Array<number | null> | null, linkStatus?: LinkStatusEnum | null, label?: string | null, problemNumber: number } | null> | null } | null };

export type GetProblemNumExamplesQueryVariables = Exact<{
  number?: InputMaybe<Scalars['Int']>;
}>;


export type GetProblemNumExamplesQuery = { __typename?: 'Query', problem?: { __typename?: 'ProblemInfo', numExamples: number } | null };


export const GetAllArrayProblemsDocument = gql`
    query GetAllArrayProblems {
  arrayProblems {
    title
    problemNumber
    description
    problemId
  }
}
    `;

/**
 * __useGetAllArrayProblemsQuery__
 *
 * To run a query within a React component, call `useGetAllArrayProblemsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAllArrayProblemsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAllArrayProblemsQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetAllArrayProblemsQuery(baseOptions?: Apollo.QueryHookOptions<GetAllArrayProblemsQuery, GetAllArrayProblemsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAllArrayProblemsQuery, GetAllArrayProblemsQueryVariables>(GetAllArrayProblemsDocument, options);
      }
export function useGetAllArrayProblemsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAllArrayProblemsQuery, GetAllArrayProblemsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAllArrayProblemsQuery, GetAllArrayProblemsQueryVariables>(GetAllArrayProblemsDocument, options);
        }
export type GetAllArrayProblemsQueryHookResult = ReturnType<typeof useGetAllArrayProblemsQuery>;
export type GetAllArrayProblemsLazyQueryHookResult = ReturnType<typeof useGetAllArrayProblemsLazyQuery>;
export type GetAllArrayProblemsQueryResult = Apollo.QueryResult<GetAllArrayProblemsQuery, GetAllArrayProblemsQueryVariables>;
export const GetAllGraphProblemsDocument = gql`
    query GetAllGraphProblems {
  graphProblems {
    title
    problemNumber
    description
    problemId
  }
}
    `;

/**
 * __useGetAllGraphProblemsQuery__
 *
 * To run a query within a React component, call `useGetAllGraphProblemsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAllGraphProblemsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAllGraphProblemsQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetAllGraphProblemsQuery(baseOptions?: Apollo.QueryHookOptions<GetAllGraphProblemsQuery, GetAllGraphProblemsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAllGraphProblemsQuery, GetAllGraphProblemsQueryVariables>(GetAllGraphProblemsDocument, options);
      }
export function useGetAllGraphProblemsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAllGraphProblemsQuery, GetAllGraphProblemsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAllGraphProblemsQuery, GetAllGraphProblemsQueryVariables>(GetAllGraphProblemsDocument, options);
        }
export type GetAllGraphProblemsQueryHookResult = ReturnType<typeof useGetAllGraphProblemsQuery>;
export type GetAllGraphProblemsLazyQueryHookResult = ReturnType<typeof useGetAllGraphProblemsLazyQuery>;
export type GetAllGraphProblemsQueryResult = Apollo.QueryResult<GetAllGraphProblemsQuery, GetAllGraphProblemsQueryVariables>;
export const GetAllGridProblemsDocument = gql`
    query GetAllGridProblems {
  gridProblems {
    title
    problemNumber
    description
    problemId
  }
}
    `;

/**
 * __useGetAllGridProblemsQuery__
 *
 * To run a query within a React component, call `useGetAllGridProblemsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAllGridProblemsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAllGridProblemsQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetAllGridProblemsQuery(baseOptions?: Apollo.QueryHookOptions<GetAllGridProblemsQuery, GetAllGridProblemsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAllGridProblemsQuery, GetAllGridProblemsQueryVariables>(GetAllGridProblemsDocument, options);
      }
export function useGetAllGridProblemsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAllGridProblemsQuery, GetAllGridProblemsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAllGridProblemsQuery, GetAllGridProblemsQueryVariables>(GetAllGridProblemsDocument, options);
        }
export type GetAllGridProblemsQueryHookResult = ReturnType<typeof useGetAllGridProblemsQuery>;
export type GetAllGridProblemsLazyQueryHookResult = ReturnType<typeof useGetAllGridProblemsLazyQuery>;
export type GetAllGridProblemsQueryResult = Apollo.QueryResult<GetAllGridProblemsQuery, GetAllGridProblemsQueryVariables>;
export const GetAllLinkedListProblemsDocument = gql`
    query GetAllLinkedListProblems {
  linkedListProblems {
    title
    problemNumber
    description
    problemId
  }
}
    `;

/**
 * __useGetAllLinkedListProblemsQuery__
 *
 * To run a query within a React component, call `useGetAllLinkedListProblemsQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetAllLinkedListProblemsQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetAllLinkedListProblemsQuery({
 *   variables: {
 *   },
 * });
 */
export function useGetAllLinkedListProblemsQuery(baseOptions?: Apollo.QueryHookOptions<GetAllLinkedListProblemsQuery, GetAllLinkedListProblemsQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetAllLinkedListProblemsQuery, GetAllLinkedListProblemsQueryVariables>(GetAllLinkedListProblemsDocument, options);
      }
export function useGetAllLinkedListProblemsLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetAllLinkedListProblemsQuery, GetAllLinkedListProblemsQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetAllLinkedListProblemsQuery, GetAllLinkedListProblemsQueryVariables>(GetAllLinkedListProblemsDocument, options);
        }
export type GetAllLinkedListProblemsQueryHookResult = ReturnType<typeof useGetAllLinkedListProblemsQuery>;
export type GetAllLinkedListProblemsLazyQueryHookResult = ReturnType<typeof useGetAllLinkedListProblemsLazyQuery>;
export type GetAllLinkedListProblemsQueryResult = Apollo.QueryResult<GetAllLinkedListProblemsQuery, GetAllLinkedListProblemsQueryVariables>;
export const GetGridFromProblemExampleDocument = gql`
    query GetGridFromProblemExample($number: Int, $example: NonNegativeInt) {
  problem(number: $number) {
    title
    problemId
    numExamples
    grids(example: $example) {
      gridId
      gridData
      interpretAs
      label
    }
  }
}
    `;

/**
 * __useGetGridFromProblemExampleQuery__
 *
 * To run a query within a React component, call `useGetGridFromProblemExampleQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetGridFromProblemExampleQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetGridFromProblemExampleQuery({
 *   variables: {
 *      number: // value for 'number'
 *      example: // value for 'example'
 *   },
 * });
 */
export function useGetGridFromProblemExampleQuery(baseOptions?: Apollo.QueryHookOptions<GetGridFromProblemExampleQuery, GetGridFromProblemExampleQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetGridFromProblemExampleQuery, GetGridFromProblemExampleQueryVariables>(GetGridFromProblemExampleDocument, options);
      }
export function useGetGridFromProblemExampleLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetGridFromProblemExampleQuery, GetGridFromProblemExampleQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetGridFromProblemExampleQuery, GetGridFromProblemExampleQueryVariables>(GetGridFromProblemExampleDocument, options);
        }
export type GetGridFromProblemExampleQueryHookResult = ReturnType<typeof useGetGridFromProblemExampleQuery>;
export type GetGridFromProblemExampleLazyQueryHookResult = ReturnType<typeof useGetGridFromProblemExampleLazyQuery>;
export type GetGridFromProblemExampleQueryResult = Apollo.QueryResult<GetGridFromProblemExampleQuery, GetGridFromProblemExampleQueryVariables>;
export const GetLinkedListFromProblemExampleDocument = gql`
    query GetLinkedListFromProblemExample($number: Int, $example: NonNegativeInt) {
  problem(number: $number) {
    title
    problemId
    numExamples
    linkedLists(example: $example) {
      listId
      listData
      linkStatus
      label
      problemNumber
    }
  }
}
    `;

/**
 * __useGetLinkedListFromProblemExampleQuery__
 *
 * To run a query within a React component, call `useGetLinkedListFromProblemExampleQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetLinkedListFromProblemExampleQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetLinkedListFromProblemExampleQuery({
 *   variables: {
 *      number: // value for 'number'
 *      example: // value for 'example'
 *   },
 * });
 */
export function useGetLinkedListFromProblemExampleQuery(baseOptions?: Apollo.QueryHookOptions<GetLinkedListFromProblemExampleQuery, GetLinkedListFromProblemExampleQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetLinkedListFromProblemExampleQuery, GetLinkedListFromProblemExampleQueryVariables>(GetLinkedListFromProblemExampleDocument, options);
      }
export function useGetLinkedListFromProblemExampleLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetLinkedListFromProblemExampleQuery, GetLinkedListFromProblemExampleQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetLinkedListFromProblemExampleQuery, GetLinkedListFromProblemExampleQueryVariables>(GetLinkedListFromProblemExampleDocument, options);
        }
export type GetLinkedListFromProblemExampleQueryHookResult = ReturnType<typeof useGetLinkedListFromProblemExampleQuery>;
export type GetLinkedListFromProblemExampleLazyQueryHookResult = ReturnType<typeof useGetLinkedListFromProblemExampleLazyQuery>;
export type GetLinkedListFromProblemExampleQueryResult = Apollo.QueryResult<GetLinkedListFromProblemExampleQuery, GetLinkedListFromProblemExampleQueryVariables>;
export const GetProblemNumExamplesDocument = gql`
    query GetProblemNumExamples($number: Int) {
  problem(number: $number) {
    numExamples
  }
}
    `;

/**
 * __useGetProblemNumExamplesQuery__
 *
 * To run a query within a React component, call `useGetProblemNumExamplesQuery` and pass it any options that fit your needs.
 * When your component renders, `useGetProblemNumExamplesQuery` returns an object from Apollo Client that contains loading, error, and data properties
 * you can use to render your UI.
 *
 * @param baseOptions options that will be passed into the query, supported options are listed on: https://www.apollographql.com/docs/react/api/react-hooks/#options;
 *
 * @example
 * const { data, loading, error } = useGetProblemNumExamplesQuery({
 *   variables: {
 *      number: // value for 'number'
 *   },
 * });
 */
export function useGetProblemNumExamplesQuery(baseOptions?: Apollo.QueryHookOptions<GetProblemNumExamplesQuery, GetProblemNumExamplesQueryVariables>) {
        const options = {...defaultOptions, ...baseOptions}
        return Apollo.useQuery<GetProblemNumExamplesQuery, GetProblemNumExamplesQueryVariables>(GetProblemNumExamplesDocument, options);
      }
export function useGetProblemNumExamplesLazyQuery(baseOptions?: Apollo.LazyQueryHookOptions<GetProblemNumExamplesQuery, GetProblemNumExamplesQueryVariables>) {
          const options = {...defaultOptions, ...baseOptions}
          return Apollo.useLazyQuery<GetProblemNumExamplesQuery, GetProblemNumExamplesQueryVariables>(GetProblemNumExamplesDocument, options);
        }
export type GetProblemNumExamplesQueryHookResult = ReturnType<typeof useGetProblemNumExamplesQuery>;
export type GetProblemNumExamplesLazyQueryHookResult = ReturnType<typeof useGetProblemNumExamplesLazyQuery>;
export type GetProblemNumExamplesQueryResult = Apollo.QueryResult<GetProblemNumExamplesQuery, GetProblemNumExamplesQueryVariables>;