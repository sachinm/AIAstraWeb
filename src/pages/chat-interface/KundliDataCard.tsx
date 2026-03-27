import React, { useState } from 'react';

type TableKind = 'generic' | 'vimsottari' | 'narayana';

interface KundliDataCardProps {
  title: string;
  data: unknown | null;
  tableKind?: TableKind;
}

interface TableModel {
  columns: string[];
  rows: string[][];
}

interface DasaBhuktiRecord {
  lord?: unknown;
  start_date?: unknown;
}

interface DasaPeriodRecord {
  maha_dasha_lord?: unknown;
  maha_start_date?: unknown;
  bhuktis?: unknown;
}

export interface KundliDisplayDataResponse {
    success: boolean;
    biodata: unknown | null;
    d1: unknown | null;
    d7: unknown | null;
    d9: unknown | null;
    d10: unknown | null;
    vimsottari_dasa: unknown | null;
    narayana_dasa: unknown | null;
    message?: string;
}
  

const toDisplayValue = (value: unknown): string => {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
};

const isNonNullObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const parseVimsottariTable = (value: unknown | null): TableModel => {
  if (!Array.isArray(value) || value.length === 0) {
    return {
      columns: ['Maha Dasha Lord', 'Maha Start DateTime', 'Bhukti Lord', 'Bhukti Start DateTime'],
      rows: [],
    };
  }

  const rows: string[][] = [];
  for (const period of value as DasaPeriodRecord[]) {
    if (!isNonNullObject(period)) {
      continue;
    }

    const mahaDashaLord = toDisplayValue(period.maha_dasha_lord);
    const mahaStartDate = toDisplayValue(period.maha_start_date);
    const bhuktiItems = Array.isArray(period.bhuktis) ? (period.bhuktis as DasaBhuktiRecord[]) : [];

    if (bhuktiItems.length === 0) {
      rows.push([mahaDashaLord, mahaStartDate, '', '']);
      continue;
    }

    for (const bhukti of bhuktiItems) {
      if (!isNonNullObject(bhukti)) {
        continue;
      }

      rows.push([
        mahaDashaLord,
        mahaStartDate,
        toDisplayValue(bhukti.lord),
        toDisplayValue(bhukti.start_date),
      ]);
    }
  }

  return {
    columns: ['Maha Dasha Lord', 'Maha Start DateTime', 'Bhukti Lord', 'Bhukti Start DateTime'],
    rows,
  };
};

const parseNarayanaTable = (value: unknown | null): TableModel => {
  if (!Array.isArray(value) || value.length === 0) {
    return {
      columns: ['Maha Rasi', 'Maha Start Date', 'Antardasha Rasi', 'Antardasha Start Date'],
      rows: [],
    };
  }

  const rows: string[][] = [];
  for (const period of value as DasaPeriodRecord[]) {
    if (!isNonNullObject(period)) {
      continue;
    }

    const mahaRasi = toDisplayValue(period.maha_dasha_lord);
    const mahaStartDate = toDisplayValue(period.maha_start_date);
    const bhuktiItems = Array.isArray(period.bhuktis) ? (period.bhuktis as DasaBhuktiRecord[]) : [];

    if (bhuktiItems.length === 0) {
      rows.push([mahaRasi, mahaStartDate, '', '']);
      continue;
    }

    for (const bhukti of bhuktiItems) {
      if (!isNonNullObject(bhukti)) {
        continue;
      }

      rows.push([
        mahaRasi,
        mahaStartDate,
        toDisplayValue(bhukti.lord),
        toDisplayValue(bhukti.start_date),
      ]);
    }
  }

  return {
    columns: ['Maha Rasi', 'Maha Start Date', 'Antardasha Rasi', 'Antardasha Start Date'],
    rows,
  };
};

const buildGenericTableModel = (value: unknown | null): TableModel => {
  if (value == null) {
    return { columns: [], rows: [] };
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return { columns: [], rows: [] };
    }

    const firstArrayItem = value[0];
    if (isNonNullObject(firstArrayItem)) {
      const columnKeys = Object.keys(firstArrayItem);
      const rows = value.map((rowValue) => {
        const rowObject = isNonNullObject(rowValue) ? rowValue : {};
        return columnKeys.map((columnKey) => toDisplayValue(rowObject[columnKey]));
      });

      return {
        columns: columnKeys,
        rows,
      };
    }

    return {
      columns: ['Value'],
      rows: value.map((item) => [toDisplayValue(item)]),
    };
  }

  if (isNonNullObject(value)) {
    const entries = Object.entries(value);
    return {
      columns: ['Key', 'Value'],
      rows: entries.map(([entryKey, entryValue]) => [entryKey, toDisplayValue(entryValue)]),
    };
  }

  return {
    columns: ['Value'],
    rows: [[toDisplayValue(value)]],
  };
};

const buildTableModel = (tableKind: TableKind, value: unknown | null): TableModel => {
  if (tableKind === 'vimsottari') {
    return parseVimsottariTable(value);
  }

  if (tableKind === 'narayana') {
    return parseNarayanaTable(value);
  }

  return buildGenericTableModel(value);
};

const KundliDataCard: React.FC<KundliDataCardProps> = ({ title, data, tableKind = 'generic' }) => {
  const tableModel = buildTableModel(tableKind, data);
  const hasRows = tableModel.rows.length > 0;
  const [isOpen, setIsOpen] = useState(hasRows);

  return (
    <div className="bg-black/40 border border-white/10 rounded-lg mb-3 overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 bg-black/60 hover:bg-black/70 transition-colors"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
      >
        <span className="text-xs font-semibold text-white">{title}</span>
        <span className="text-[10px] text-gray-400">
          {!hasRows ? 'Empty' : isOpen ? 'Hide' : 'Show'}
        </span>
      </button>
      {isOpen && (
        <div className="max-h-56 overflow-x-auto overflow-y-auto bg-black/40">
          <table className="min-w-full text-left text-xs text-gray-200 whitespace-nowrap">
            {tableModel.columns.length > 0 && (
              <thead>
                <tr>
                  {tableModel.columns.map((columnName) => (
                    <th
                      key={columnName}
                      className="px-2 py-1 text-[10px] text-gray-400 font-semibold text-left"
                    >
                      {columnName}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {tableModel.rows.length > 0 ? (
                tableModel.rows.map((row, rowIndex) => (
                  <tr key={`${title}-row-${rowIndex}`}>
                    {row.map((cellValue, cellIndex) => (
                      <td
                        key={`${title}-row-${rowIndex}-cell-${cellIndex}`}
                        className="px-2 py-1 text-[11px] text-gray-200"
                      >
                        {cellValue}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-2 py-1 text-xs text-gray-500"
                    colSpan={tableModel.columns.length > 0 ? tableModel.columns.length : 1}
                  >
                    No records
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default KundliDataCard;
