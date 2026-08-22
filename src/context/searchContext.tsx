import React, { createContext, useContext, useMemo, useState } from "react";

export type SearchContextType = {
  isOpen: boolean;
  query: string;
  openSearch: () => void;
  closeSearch: () => void;
  setQuery: (query: string) => void;
};

export const SearchContext = createContext<SearchContextType>({
  isOpen: false,
  query: "",
  openSearch: () => {},
  closeSearch: () => {},
  setQuery: () => {},
});

export const SearchProvider = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const value = useMemo<SearchContextType>(
    () => ({
      isOpen,
      query,
      openSearch: () => setIsOpen(true),
      closeSearch: () => {
        setIsOpen(false);
        setQuery("");
      },
      setQuery,
    }),
    [isOpen, query]
  );

  return (
    <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
  );
};

export const useSearch = () => {
  return useContext(SearchContext);
};

export default SearchProvider;
