import type { BoardCell } from './types';

/** Cria as 6 casas de um lado: 3 colunas x 2 linhas (frente/trás). */
export function createEmptyBoard(): BoardCell[] {
  const cells: BoardCell[] = [];
  const rows: Array<'front' | 'back'> = ['front', 'back'];
  let index = 0;
  for (const row of rows) {
    for (let col = 0; col < 3; col++) {
      cells.push({
        index: index++,
        row,
        col,
        terrain: null,
        terrainStack: 0,
        occupant: null,
        items: [],
      });
    }
  }
  return cells;
}

export function creaturesOnBoard(board: BoardCell[]) {
  return board.filter((c) => c.occupant?.kind === 'creature');
}

/** Casas adjacentes (mesma linha ou coluna, distância 1). */
export function adjacentCells(board: BoardCell[], cell: BoardCell): BoardCell[] {
  return board.filter(
    (c) =>
      c.index !== cell.index &&
      Math.abs(c.col - cell.col) + (c.row === cell.row ? 0 : 1) === 1,
  );
}
