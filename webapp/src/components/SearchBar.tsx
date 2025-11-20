import { useEffect, useState } from 'react';

interface SearchBarProps {
  value: string;
  placeholder?: string;
  onSearch: (value: string) => void;
}

export function SearchBar({
  value,
  onSearch,
  placeholder = 'Search albums, tracks, eras...',
}: SearchBarProps) {
  const [internalValue, setInternalValue] = useState(value);

  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (internalValue !== value) {
        onSearch(internalValue);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [internalValue, onSearch, value]);

  return (
    <div className="search-bar">
      <input
        type="search"
        className="search-input"
        placeholder={placeholder}
        value={internalValue}
        onChange={(event) => setInternalValue(event.target.value)}
      />
    </div>
  );
}

