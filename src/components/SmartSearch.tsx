'use client';

import { useEffect, useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SearchResult {
    id: string;
    title: string;
    subtitle?: string;
    badge?: string;
    href: string;
}

interface SmartSearchProps {
    placeholder?: string;
    searchFields?: string[];
    onSearch: (term: string) => Promise<SearchResult[]>;
    onSelect?: (result: SearchResult) => void;
    className?: string;
    minChars?: number;
}

export function SmartSearch({
    placeholder = 'Buscar...',
    onSearch,
    onSelect,
    className,
    minChars = 2,
}: SmartSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    useEffect(() => {
        if (query.trim().length < minChars) {
            setResults([]);
            setIsOpen(false);
            return;
        }

        const debounceTimer = setTimeout(async () => {
            setIsSearching(true);
            try {
                const searchResults = await onSearch(query);
                setResults(searchResults);
                setIsOpen(searchResults.length > 0);
                setSelectedIndex(-1);
            } catch (error) {
                console.error('Search error:', error);
                setResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(debounceTimer);
    }, [query, onSearch, minChars]);

    const handleSelect = (result: SearchResult) => {
        if (onSelect) {
            onSelect(result);
        } else {
            window.location.href = result.href;
        }
        setQuery('');
        setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex((prev) => Math.max(prev - 1, -1));
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0 && results[selectedIndex]) {
                    handleSelect(results[selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                setSelectedIndex(-1);
                break;
        }
    };

    const handleClear = () => {
        setQuery('');
        setResults([]);
        setIsOpen(false);
        setSelectedIndex(-1);
    };

    const highlightMatch = (text: string, searchTerm: string) => {
        const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
        return parts.map((part, index) =>
            part.toLowerCase() === searchTerm.toLowerCase() ? (
                <mark key={index} className="bg-yellow-200 text-yellow-900 font-semibold">
                    {part}
                </mark>
            ) : (
                part
            )
        );
    };

    return (
        <div className={cn('relative', className)}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => query.trim().length >= minChars && results.length > 0 && setIsOpen(true)}
                    placeholder={placeholder}
                    className="pl-10 pr-10"
                />
                {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                )}
                {query && !isSearching && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* Results dropdown */}
            {isOpen && results.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg z-50">
                    <ul>
                        {results.map((result, index) => (
                            <li key={result.id}>
                                <button
                                    type="button"
                                    onClick={() => handleSelect(result)}
                                    className={cn(
                                        'w-full text-left px-4 py-3 transition hover:bg-slate-50',
                                        selectedIndex === index && 'bg-blue-50 hover:bg-blue-100',
                                        index === 0 && 'rounded-t-xl',
                                        index === results.length - 1 && 'rounded-b-xl'
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-slate-900">
                                                {highlightMatch(result.title, query)}
                                            </p>
                                            {result.subtitle && (
                                                <p className="mt-1 text-xs text-slate-500">{result.subtitle}</p>
                                            )}
                                        </div>
                                        {result.badge && (
                                            <Badge variant="outline" className="shrink-0">
                                                {result.badge}
                                            </Badge>
                                        )}
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {isOpen && results.length === 0 && query.trim().length >= minChars && !isSearching && (
                <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-slate-200 bg-white p-4 shadow-lg z-50">
                    <p className="text-sm text-slate-500 text-center">
                        No se encontraron resultados para "{query}"
                    </p>
                </div>
            )}
        </div>
    );
}
