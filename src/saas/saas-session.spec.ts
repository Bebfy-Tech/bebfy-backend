import {describe,it,expect,vi} from 'vitest';
import {SaasAuthService} from './saas-auth.service';
import {BadRequestException,UnauthorizedException} from '@nestjs/common';
import type {PrismaService} from '../core/prisma/prisma.service';
import type {JwtService} from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
const setup=async()=>{
 const account={id:'a',codigo:1,nome:'Admin QA',email:null,cargo:'SUPER_ADMIN',permissoes:[],ativo:true,sessaoId:'session',senha:await bcrypt.hash('senha-inicial-qa',4)};
 const model={findUnique:vi.fn().mockResolvedValue(account),updateMany:vi.fn().mockResolvedValue({count:1}),update:vi.fn().mockResolvedValue(account)};
 const jwt={signAsync:vi.fn().mockResolvedValue('token-qa')};
 return {account,model,jwt,service:new SaasAuthService({saasOperador:model} as unknown as PrismaService,jwt as unknown as JwtService)};
};
describe('Sessão e perfil SaaS',()=>{
 it('não cria token quando a conta muda durante login',async()=>{
  const {service,model,jwt}=await setup();model.updateMany.mockResolvedValue({count:0});
  await expect(service.login(1,'senha-inicial-qa')).rejects.toThrow(UnauthorizedException);
  expect(jwt.signAsync).not.toHaveBeenCalled();
 });
 it('distingue senha atual incorreta de sessão inválida',async()=>{
  const {service,model}=await setup();
  await expect(service.atualizarPerfil('a',{senhaAtual:'errada',novaSenha:'nova-senha-qa'},'session')).rejects.toThrow(BadRequestException);
  await expect(service.atualizarPerfil('a',{nome:'Novo nome'},'revogada')).rejects.toThrow(UnauthorizedException);
  expect(model.update).not.toHaveBeenCalled();
 });
 it('rejeita repetir senha e invalida sessão na troca válida',async()=>{
  const {service,account,model}=await setup();
  await expect(service.atualizarPerfil('a',{senhaAtual:'senha-inicial-qa',novaSenha:'senha-inicial-qa'},'session')).rejects.toThrow(BadRequestException);
  await service.atualizarPerfil('a',{senhaAtual:'senha-inicial-qa',novaSenha:'nova-senha-qa'},'session');
  expect(model.update).toHaveBeenCalledWith(expect.objectContaining({where:{id:'a',ativo:true,sessaoId:'session',senha:account.senha},data:expect.objectContaining({sessaoId:null})}));
 });
});
