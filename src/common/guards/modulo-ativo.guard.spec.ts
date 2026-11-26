import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExigirModulo, ModuloAtivoGuard } from './modulo-ativo.guard';
import { resolverModulos, MODULOS_PADRAO } from '../modulos/plano-modulos';
class TestEndpoint { @ExigirModulo('FIADOS') action() {} }
function context(empresaId?: number): any { return {getHandler:()=>TestEndpoint.prototype.action,getClass:()=>TestEndpoint,switchToHttp:()=>({getRequest:()=>({user:{empresaId}})})}; }
function guard(plano: any, modulosAtivos: any[] = []) {
  const prisma:any={empresa:{findUnique:vi.fn().mockResolvedValue({plano,modulosAtivos})}};
  return new ModuloAtivoGuard(new Reflector(),prisma);
}
describe('Acesso por plano e exceção',()=>{
  it('preserva empresas legadas sem plano',async()=>{await expect(guard(null).canActivate(context(1))).resolves.toBe(true);});
  it('bloqueia módulo ausente do plano',async()=>{await expect(guard({modulosPadrao:['CAIXA_PDV']}).canActivate(context(1))).rejects.toThrow(ForbiddenException);});
  it('permite inclusão explícita',async()=>{await expect(guard({modulosPadrao:[]},[{modulo:'FIADOS',ativo:true}]).canActivate(context(1))).resolves.toBe(true);});
  it('bloqueia exclusão explícita mesmo no plano',async()=>{await expect(guard({modulosPadrao:['FIADOS']},[{modulo:'FIADOS',ativo:false}]).canActivate(context(1))).rejects.toThrow(ForbiddenException);});
  it('bloqueia usuário sem empresa',async()=>{await expect(guard(null).canActivate(context())).rejects.toThrow(ForbiddenException);});
  it('não libera recursos de atacado pendentes nem por exceção',()=>{expect(resolverModulos({plano:{modulosPadrao:['PEDIDOS_ATACADO']},modulosAtivos:[{modulo:'ROTAS_CAMINHOES',ativo:true}]}).ROTAS_CAMINHOES).toBe(false);});
  it('Basic não herda módulos do Pro',()=>{expect(resolverModulos({plano:{modulosPadrao:MODULOS_PADRAO.VAREJO_BASICO},modulosAtivos:[]}).COMPRAS_FORNECEDORES).toBe(false);});
});
