import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AgentSkill,
  QueueSkillRequirement,
  Skill,
} from '../../database/entities';
import { QueuesService } from '../queues/queues.service';
import { sanitizeText } from '../../common/utils/asterisk-sanitize';
import {
  AssignAgentSkillDto,
  CreateSkillDto,
  SetQueueSkillDto,
  UpdateSkillDto,
} from './dto/skill.dto';

const MAX_LEVEL = 5;

export interface SkillMember {
  extension: string;
  penalty: number;
  skills: { skillId: string; level: number }[];
}

/**
 * Skill-based routing (Module 2). Owns the skills catalogue, per-agent
 * proficiencies, and per-queue requirements, and turns them into queue member
 * penalties: an agent qualifies only if they meet every required skill's min
 * level, and higher proficiency yields a lower penalty (served first).
 */
@Injectable()
export class SkillsService {
  private readonly logger = new Logger(SkillsService.name);

  constructor(
    @InjectRepository(Skill)
    private readonly skills: Repository<Skill>,
    @InjectRepository(AgentSkill)
    private readonly agentSkills: Repository<AgentSkill>,
    @InjectRepository(QueueSkillRequirement)
    private readonly queueSkills: Repository<QueueSkillRequirement>,
    private readonly queues: QueuesService,
  ) {}

  /* ------------------------------ Catalogue ---------------------------- */

  async createSkill(dto: CreateSkillDto): Promise<Skill> {
    const name = sanitizeText(dto.name, 80);
    if (await this.skills.findOne({ where: { name } })) {
      throw new ConflictException(`Skill "${name}" already exists`);
    }
    return this.skills.save(
      this.skills.create({
        name,
        description: dto.description ? sanitizeText(dto.description, 200) : null,
      }),
    );
  }

  listSkills(): Promise<Skill[]> {
    return this.skills.find({ order: { name: 'ASC' } });
  }

  private async getSkill(id: string): Promise<Skill> {
    const skill = await this.skills.findOne({ where: { id } });
    if (!skill) throw new NotFoundException('Skill not found');
    return skill;
  }

  async updateSkill(id: string, dto: UpdateSkillDto): Promise<Skill> {
    const skill = await this.getSkill(id);
    if (dto.name !== undefined) skill.name = sanitizeText(dto.name, 80);
    if (dto.description !== undefined) {
      skill.description = dto.description
        ? sanitizeText(dto.description, 200)
        : null;
    }
    return this.skills.save(skill);
  }

  async removeSkill(id: string): Promise<void> {
    const res = await this.skills.delete(id);
    if (!res.affected) throw new NotFoundException('Skill not found');
  }

  /* --------------------------- Agent skills ---------------------------- */

  async assignAgentSkill(dto: AssignAgentSkillDto): Promise<AgentSkill> {
    await this.getSkill(dto.skillId);
    const existing = await this.agentSkills.findOne({
      where: { extension: dto.extension, skillId: dto.skillId },
    });
    if (existing) {
      existing.level = dto.level;
      return this.agentSkills.save(existing);
    }
    return this.agentSkills.save(
      this.agentSkills.create({
        extension: dto.extension,
        skillId: dto.skillId,
        level: dto.level,
      }),
    );
  }

  listAgentSkills(extension?: string): Promise<AgentSkill[]> {
    return this.agentSkills.find({
      where: extension ? { extension } : {},
      relations: { skill: true },
      order: { extension: 'ASC' },
    });
  }

  async removeAgentSkill(id: string): Promise<void> {
    const res = await this.agentSkills.delete(id);
    if (!res.affected) throw new NotFoundException('Agent skill not found');
  }

  /* -------------------------- Queue requirements ----------------------- */

  async setQueueSkill(dto: SetQueueSkillDto): Promise<QueueSkillRequirement> {
    await this.getSkill(dto.skillId);
    const existing = await this.queueSkills.findOne({
      where: { queueName: dto.queueName, skillId: dto.skillId },
    });
    if (existing) {
      existing.minLevel = dto.minLevel ?? existing.minLevel;
      return this.queueSkills.save(existing);
    }
    return this.queueSkills.save(
      this.queueSkills.create({
        queueName: sanitizeText(dto.queueName, 128),
        skillId: dto.skillId,
        minLevel: dto.minLevel ?? 1,
      }),
    );
  }

  listQueueSkills(queueName?: string): Promise<QueueSkillRequirement[]> {
    return this.queueSkills.find({
      where: queueName ? { queueName } : {},
      relations: { skill: true },
      order: { queueName: 'ASC' },
    });
  }

  async removeQueueSkill(id: string): Promise<void> {
    const res = await this.queueSkills.delete(id);
    if (!res.affected) throw new NotFoundException('Queue requirement not found');
  }

  /* ---------------------------- Routing plan --------------------------- */

  /** Compute the qualified members + penalties for a queue (read-only). */
  async computeMembership(queueName: string): Promise<SkillMember[]> {
    const reqs = await this.queueSkills.find({ where: { queueName } });
    if (reqs.length === 0) return [];

    const reqSkillIds = reqs.map((r) => r.skillId);
    const rows = await this.agentSkills.find({
      where: { skillId: In(reqSkillIds) },
    });

    // extension -> (skillId -> level)
    const byExt = new Map<string, Map<string, number>>();
    for (const row of rows) {
      if (!byExt.has(row.extension)) byExt.set(row.extension, new Map());
      byExt.get(row.extension)!.set(row.skillId, row.level);
    }

    const members: SkillMember[] = [];
    for (const [extension, levels] of byExt) {
      let qualified = true;
      let penalty = 0;
      const skills: { skillId: string; level: number }[] = [];
      for (const req of reqs) {
        const level = levels.get(req.skillId);
        if (level === undefined || level < req.minLevel) {
          qualified = false;
          break;
        }
        penalty += MAX_LEVEL - level;
        skills.push({ skillId: req.skillId, level });
      }
      if (qualified) members.push({ extension, penalty, skills });
    }
    members.sort((a, b) => a.penalty - b.penalty);
    return members;
  }

  /** Apply the computed plan to the live queue membership. */
  async applyRouting(
    queueName: string,
  ): Promise<{ added: number; updated: number; members: SkillMember[] }> {
    const members = await this.computeMembership(queueName);
    const result = await this.queues.applySkillMembership(
      queueName,
      members.map((m) => ({ extension: m.extension, penalty: m.penalty })),
    );
    this.logger.log(
      `Skill routing applied to ${queueName}: ${members.length} qualified`,
    );
    return { ...result, members };
  }
}
