const sortOptions = [
  { value: 'title', label: 'Alphabetical' },
  { value: 'year', label: 'Release Year' },
  { value: 'recent', label: 'Recently Synced' },
] as const;

interface FilterPanelProps {
  sort: 'title' | 'year' | 'recent';
  year?: number;
  onChange: (filters: {
    sort?: 'title' | 'year' | 'recent';
    year?: number;
  }) => void;
  onReset: () => void;
}

export function FilterPanel({
  sort,
  year,
  onChange,
  onReset,
}: FilterPanelProps) {
  return (
    <section className="filters">
      <div className="filter-group">
        <label className="filter-title" htmlFor="year-filter">
          Year
        </label>
        <input
          id="year-filter"
          type="number"
          min={1960}
          max={2030}
          placeholder="e.g. 1979"
          value={year ?? ''}
          onChange={(event) =>
            onChange({
              year: event.target.value ? Number(event.target.value) : undefined,
            })
          }
        />
      </div>

      <div className="filter-group">
        <label className="filter-title" htmlFor="sort-filter">
          Sort
        </label>
        <select
          id="sort-filter"
          value={sort}
          onChange={(event) =>
            onChange({
              sort: event.target.value as FilterPanelProps['sort'],
            })
          }
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <button type="button" className="reset-button" onClick={onReset}>
        Reset
      </button>
    </section>
  );
}

