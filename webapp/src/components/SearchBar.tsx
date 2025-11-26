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
      <div className="search-input-wrapper">
        <svg
          className="search-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <input
          type="search"
          className="search-input"
          placeholder={placeholder}
          value={internalValue}
          onChange={(event) => setInternalValue(event.target.value)}
        />
      </div>
    </div>
  );
}

