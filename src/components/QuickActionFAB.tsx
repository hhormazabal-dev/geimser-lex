'use client';

import { useState } from 'react';
import { Plus, X, FolderOpen, UserPlus, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface QuickAction {
    id: string;
    label: string;
    icon: React.ReactNode;
    href?: string;
    onClick?: () => void;
    description: string;
}

const QUICK_ACTIONS: QuickAction[] = [
    {
        id: 'new-case',
        label: 'Nuevo caso',
        icon: <FolderOpen className="h-5 w-5" />,
        href: '/cases/new',
        description: 'Crear un nuevo expediente legal',
    },
    {
        id: 'new-client',
        label: 'Nuevo cliente',
        icon: <UserPlus className="h-5 w-5" />,
        href: '/clients',
        description: 'Registrar un nuevo cliente en el sistema',
    },
    {
        id: 'new-billing',
        label: 'Registrar cobro',
        icon: <Wallet className="h-5 w-5" />,
        href: '/billing',
        description: 'Registrar un nuevo cobro o pago',
    },
];

export function QuickActionFAB() {
    const [isOpen, setIsOpen] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const router = useRouter();

    const handleActionClick = (action: QuickAction) => {
        if (action.onClick) {
            action.onClick();
        } else if (action.href) {
            router.push(action.href);
        }
        setShowMenu(false);
    };

    return (
        <>
            {/* Floating Action Button */}
            <div className="fixed bottom-6 right-6 z-50">
                <div className="relative">
                    {/* Action buttons (expand from FAB) */}
                    {showMenu && (
                        <div className="absolute bottom-16 right-0 mb-2 space-y-2">
                            {QUICK_ACTIONS.map((action) => (
                                <div
                                    key={action.id}
                                    className="flex items-center justify-end gap-3 animate-in fade-in-0 slide-in-from-bottom-2"
                                >
                                    <div className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
                                        {action.label}
                                    </div>
                                    <Button
                                        size="lg"
                                        variant="default"
                                        onClick={() => handleActionClick(action)}
                                        className="h-12 w-12 rounded-full bg-blue-600 p-0 shadow-lg transition hover:bg-blue-700 hover:shadow-xl"
                                    >
                                        {action.icon}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Main FAB */}
                    <Button
                        size="lg"
                        onClick={() => setShowMenu(!showMenu)}
                        className={cn(
                            'h-14 w-14 rounded-full bg-blue-600 p-0 shadow-2xl transition hover:bg-blue-700 hover:shadow-2xl hover:scale-110',
                            showMenu && 'rotate-45'
                        )}
                    >
                        {showMenu ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
                    </Button>
                </div>
            </div>

            {/* Dialog for future forms (optional) */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-[550px]">
                    <DialogHeader>
                        <DialogTitle>Acción rápida</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-slate-600">
                            Selecciona una acción para continuar.
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
