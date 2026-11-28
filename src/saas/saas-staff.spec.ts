import {describe,it,expect,vi} from 'vitest';
import {SaasAuthService} from './saas-auth.service';
import type {PrismaService} from '../core/prisma/prisma.service';
import type {JwtService} from '@nestjs/jwt';
import {ForbiddenException,BadRequestException} from '@nestjs/common';
const actor={id:'a',cargo:'OPERADOR',ativo:true,permissoes:['FUNCIONARIOS','SUPORTE']};
const target={id:'b',codigo:3,nome:'Operador',cargo:'OPERADOR',ativo:true,permissoes:['SUPORTE']};
const createService=(other=target,who=actor)=>{
 const model={findUnique:vi.fn().mockImplementation(async ({where})=>where.id==='a'?who:where.id==='b'?other:null),update:vi.fn().mockResolvedValue(other),create:vi.fn()};
 return {model,service:new SaasAuthService({saasOperador:model} as unknown as PrismaService,{} as JwtService)};
};
describe('Gestão segura da equipe SaaS',()=>{
 it('impede delegar acesso financeiro a gestor que só tem suporte',async()=>{
 const {service,model}=createService();
 await expect(service.criar({codigo:4,nome:'Novo operador',senha:'senha-teste-123',cargo:'OPERADOR',permissoes:['EMPRESAS']},'a')).rejects.toThrow(ForbiddenException);
 await expect(service.atualizar('b',{permissoes:['EMPRESAS']},'a')).rejects.toThrow(ForbiddenException);
 expect(model.update).not.toHaveBeenCalled();
 });
 it('impede capturar conta mais privilegiada ou outro gestor',async()=>{
 const {service}=createService({...target,permissoes:['FUNCIONARIOS','EMPRESAS']});
 await expect(service.atualizar('b',{senha:'nova-senha-teste'},'a')).rejects.toThrow(ForbiddenException);
 await expect(service.encerrarSessao('b','a')).rejects.toThrow(ForbiddenException);
 });
 it('reserva os códigos 1 e 2 mesmo sem cadastro prévio',async()=>{
 const {service}=createService();
 await expect(service.criar({codigo:1,nome:'Novo operador',senha:'senha-teste-123',cargo:'OPERADOR',permissoes:[]},'a')).rejects.toThrow(BadRequestException);
 });
 it('revoga a sessão quando as permissões mudam',async()=>{
 const {service,model}=createService();
 await service.atualizar('b',{permissoes:[]},'a');
 expect(model.update).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({permissoes:[],sessaoId:null})}));
 });
 it('permite encerrar a sessão de operador subordinado',async()=>{
 const {service,model}=createService();
 await service.encerrarSessao('b','a');
 expect(model.update).toHaveBeenCalledWith({where:{id:'b'},data:{sessaoId:null}});
 });
});
