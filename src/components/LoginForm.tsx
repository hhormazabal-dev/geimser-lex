'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const supabase = createClient();

  const redirectTo = searchParams.get('redirectTo') || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: 'Error de autenticación',
          description: 'Credenciales inválidas. Por favor verifica tu email y contraseña.',
          variant: 'destructive',
        });
        return;
      }

      if (data.user) {
        toast({
          title: 'Inicio de sesión exitoso',
          description: 'Bienvenido a LEXCHILE',
        });
        router.push(redirectTo);
        router.refresh();
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Error del sistema',
        description: 'Ocurrió un error inesperado. Por favor intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (error) {
        toast({
          title: 'Error de demostración',
          description: 'No se pudo acceder con las credenciales de demostración.',
          variant: 'destructive',
        });
        return;
      }

      if (data.user) {
        toast({
          title: 'Acceso de demostración',
          description: 'Has ingresado con una cuenta de demostración',
        });
        router.push('/dashboard');
        router.refresh();
      }
    } catch (error) {
      console.error('Demo login error:', error);
      toast({
        title: 'Error del sistema',
        description: 'Ocurrió un error inesperado.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='space-y-6'>
      <form onSubmit={handleSubmit} className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='email'>Email</Label>
          <Input
            id='email'
            type='email'
            placeholder='tu@email.com'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            className='w-full'
          />
        </div>

        <div className='space-y-2'>
          <Label htmlFor='password'>Contraseña</Label>
          <div className='relative'>
            <Input
              id='password'
              type={showPassword ? 'text' : 'password'}
              placeholder='Tu contraseña'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              className='w-full pr-10'
            />
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
            >
              {showPassword ? (
                <EyeOff className='h-4 w-4 text-gray-400' />
              ) : (
                <Eye className='h-4 w-4 text-gray-400' />
              )}
            </Button>
          </div>
        </div>

        <Button
          type='submit'
          className='w-full'
          disabled={isLoading || !email || !password}
        >
          {isLoading ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              Iniciando sesión...
            </>
          ) : (
            'Iniciar Sesión'
          )}
        </Button>
      </form>

      {/* Botones de demostración */}
      <div className='space-y-2'>
        <div className='text-center text-sm text-gray-500'>
          Acceso rápido de demostración:
        </div>
        <div className='grid grid-cols-1 gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleDemoLogin('admin@lexchile.cl', 'admin123')}
            disabled={isLoading}
            className='text-xs'
          >
            Admin de Firma
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleDemoLogin('carlos@lexchile.cl', 'abogado123')}
            disabled={isLoading}
            className='text-xs'
          >
            Abogado
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleDemoLogin('juan@cliente.cl', 'cliente123')}
            disabled={isLoading}
            className='text-xs'
          >
            Cliente
          </Button>
        </div>
      </div>
    </div>
  );
}
