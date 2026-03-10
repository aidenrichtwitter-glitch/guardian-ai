export const ALTER_COLUMN_TYPE = `
  ALTER TABLE grids
  ALTER COLUMN gridid TYPE UUID;
`

enum PSQLDataType {
  BIGINT = "BIGINT",
  INTEGER_ARRAY = "INTEGER[][]",
  SMALLINT = "SMALLINT"

}

export const addColumnToGrids = (columnName: string, dataType: PSQLDataType): string => {
  return `ALTER TABLE grids
  ADD COLUMN ${columnName} ${dataType}`;
}

export const changeDimensionsOfGrid = (
  width: number, 
  height: number, 
  pNum: number
) => {
  return `UPDATE grids
  SET width = ${width}, height = ${height}
  WHERE problem_number = 200;
  `
}

type CreateGridOnDatabaseProps = {
  problemNumber: number,
  data: number[][],
  label: string,
}

const genreatePSQL2DARRAY = (data: number[][]) => {
  let retString = ``;
  retString += `{`;
  for (let i = 0; i < data.length; i++) {
    retString += `{`
    for (let j = 0; j < data[0].length; j++) {
      retString += `${data[i][j]}`
    }
    if (i !== data.length - 1) {
      retString += `}\n`
    } else {
      retString += `}`
    }
  }
}

export const createGridOnDatabase = ({
  problemNumber,
  data,
  label,
}: CreateGridOnDatabaseProps) => {

  const dataArray = genreatePSQL2DARRAY(data);

  return `INSERT INTO grids
  VALUES(${problemNumber},
  '${dataArray}',
  ${data[0].length},
  ${data.length},
  '${label}'))`;
}

type UpdateExamplesProps = {
  tableName: string,
  problemNumber: number
}

export const updateExamples = ({
  tableName,
  problemNumber
}: UpdateExamplesProps) => {
  return `CREATE TEMPORARY SEQUENCE updt MINVALUE 0 START 0;
  UPDATE ${tableName} set "fromExample"=nextVal('updt') 
  WHERE "problemNumber"=${problemNumber}
  `
}

export const deleteAllDSFromNumber = (tableName: string, problemNumber: number) => {
  return `DELETE from ${tableName} WHERE "problemNumber"=${problemNumber}`
}

export const constrainProblemNumberAndData = (tableName: string) => {
  return `ALTER TABLE ${tableName} ADD CONSTRAINT UNIQUE("problemNumber", "data")`
}

export const SQLGetDataTypeProblems = (dataTypeTable: "grids" | "arrays" | "linkedLists", order: "ASC" | "DESC") => {
  return `SELECT "problemNumber", title, description, "problemId", "numExamples"
  FROM "problemInfo"
  INNER JOIN "${dataTypeTable}" USING ("problemNumber")
  GROUP BY "problemNumber", title, description, "problemId", "numExamples"
  ORDER BY "problemNumber" ${order};`
}

export const createLinkStatusEnum = () => {
  return `CREATE TYPE "LinkStatusEnum" AS ENUM ('FORWARD_LINKED','BACK_LINKED','DOUBLY_LINKED','UNLINKED');`
}

export const createLinkedListTable = () => {
  return `CREATE TABLE "linkedLists" (
    "listId" uuid DEFAULT gen_random_uuid(),
    "problemNumber" INT,
    "fromExample" INT,
    "exampleIndex" INT,
    "label" VARCHAR(255),
    "listData" integer[],
    "linkStatus" "linkStatusEnum"
    @PrimaryGeneratedColumn("uuid")
  );`
}

export const changeTableName = () => {
  return `ALTER TABLE "linkedLists" RENAME TO "linkedLists"`
}



