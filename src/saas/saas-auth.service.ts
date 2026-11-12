import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { SaasCargo } from '@prisma/client';

export const SAAS_PERMISSIONS = ['EMPRESAS', 'PLANOS', 'MODULOS', 'FUNCIONARIOS'] as const;
export type SaasPermission = typeof SAAS_PERMISSIONS[number];

@Injectable()
export class SaasAuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  private publicUser(user: { id: string; codigo: number; nome: string; email?: string | null; cargo: SaasCargo; permissoes: string[]; ativo: boolean }) {
    return { id: user.id, codigo: user.codigo, nome: user.nome, email: user.email, cargo: user.cargo, permissoes: user.permissoes, ativo: user.ativo };
  }

  async login(codigo: number, senha: string) {
    const user = await this.prisma.saasOperador.findUnique({ where: { codigo } });
    if (!user || !user.ativo || !await bcrypt.compare(senha, user.senha)) {
      throw new UnauthorizedException('Login ou senha incorretos.');
    }
    const sessaoId = randomUUID();
    await this.prisma.saasOperador.update({ where: { id: user.id }, data: { sessaoId } });
    return {
      access_token: await this.jwt.signAsync({ sub: user.id, tipo: 'SAAS_ADMIN', sessaoId }, { expiresIn: '8h' }),
      usuario: this.publicUser(user),
    };
  }

  async sair(id: string, sessaoId: string) {
    await this.prisma.saasOperador.updateMany({ where: { id, sessaoId }, data: { sessaoId: null } });
    return { encerrada: true };
  }

  async listar() {
    const users = await this.prisma.saasOperador.findMany({
      select: { id: true, codigo: true, nome: true, cargo: true, permissoes: true, ativo: true, email: true, criadoEm: true },
      orderBy: { codigo: 'asc' },
    });
    return users;
  }

  async criar(input: { codigo: number; nome: string; senha: string; cargo: SaasCargo; permissoes: string[] }) {
    if (input.senha.length < 12) throw new BadRequestException('A senha deve ter no mínimo 12 caracteres.');
    if (input.permissoes.some(p => !SAAS_PERMISSIONS.includes(p as SaasPermission))) {
      throw new BadRequestException('Permissão inválida.');
    }
    if (input.cargo === SaasCargo.SUPER_ADMIN) throw new ForbiddenException('Outros superadministradores só podem ser provisionados localmente.');
    const duplicate = await this.prisma.saasOperador.findUnique({ where: { codigo: input.codigo } });
    if (duplicate) throw new ConflictException('Código de acesso já cadastrado.');
    const senha = await bcrypt.hash(input.senha, 12);
    const user = await this.prisma.saasOperador.create({
      data: { codigo: input.codigo, nome: input.nome.trim(), senha, cargo: input.cargo, permissoes: input.permissoes },
    });
    return this.publicUser(user);
  }

  async atualizarPerfil(id: string, input: { nome?: string; email?: string; senhaAtual?: string; novaSenha?: string }) {
    const existente = await this.prisma.saasOperador.findUnique({ where: { id } });
    if (!existente?.ativo) throw new UnauthorizedException('Sessão inválida.');
    if (input.novaSenha && (!input.senhaAtual || !await bcrypt.compare(input.senhaAtual, existente.senha))) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }
    if (input.novaSenha && input.novaSenha.length < 12) {
      throw new BadRequestException('A nova senha deve conter pelo menos 12 caracteres.');
    }
    if (!input.nome && input.email === undefined && !input.novaSenha) throw new BadRequestException('Nenhuma alteração informada.');
    const atualizado = await this.prisma.saasOperador.update({
      where: { id },
      data: {
        ...(input.nome !== undefined ? { nome: input.nome.trim() } : {}),
        ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
        ...(input.novaSenha ? { senha: await bcrypt.hash(input.novaSenha, 12), sessaoId: null } : {}),
      },
    });
    return this.publicUser(atualizado);
  }

  async atualizar(id: string, input: { codigo?: number; nome?: string; senha?: string; permissoes?: string[]; ativo?: boolean }) {
    const existing = await this.prisma.saasOperador.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException('Funcionário não encontrado.');
    if (existing.cargo === SaasCargo.SUPER_ADMIN) throw new ForbiddenException('Superadministradores são geridos somente por provisionamento seguro.');
    if (input.permissoes?.some(p => !SAAS_PERMISSIONS.includes(p as SaasPermission))) throw new BadRequestException('Permissão inválida.');
    if (input.senha && input.senha.length < 12) throw new BadRequestException('A senha deve ter no mínimo 12 caracteres.');
    const user = await this.prisma.saasOperador.update({
      where: { id },
      data: {
        ...(input.nome !== undefined ? { nome: input.nome.trim() } : {}),
        ...(input.codigo !== undefined ? { codigo: input.codigo } : {}),
        ...(input.permissoes !== undefined ? { permissoes: input.permissoes } : {}),
        ...(input.ativo !== undefined ? { ativo: input.ativo, sessaoId: null } : {}),
        ...(input.senha ? { senha: await bcrypt.hash(input.senha, 12), sessaoId: null } : {}),
      },
    });
    return this.publicUser(user);
  }
}
