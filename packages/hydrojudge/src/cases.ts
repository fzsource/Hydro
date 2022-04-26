import path from 'path';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import { max, sum } from 'lodash';
import readYamlCases, { convertIniConfig } from '@hydrooj/utils/lib/cases';
import { readSubtasksFromFiles } from '@hydrooj/utils/lib/common';
import { changeErrorType } from '@hydrooj/utils/lib/utils';
import { getConfig } from './config';
import { FormatError, SystemError } from './error';
import { ensureFile, parseMemoryMB } from './utils';

async function readAutoCases(folder: string, { next }, cfg, rst) {
    const config = {
        checker_type: 'default',
        count: 0,
        subtasks: [],
        judge_extra_files: [],
        user_extra_files: [],
    };
    const checkFile = ensureFile(folder);
    try {
        const files = await fs.readdir(folder);
        if (await fs.pathExists(path.resolve(folder, 'input'))) {
            const inputs = await fs.readdir(path.resolve(folder, 'input'));
            files.push(...inputs.map((i) => `input/${i}`));
        }
        if (await fs.pathExists(path.resolve(folder, 'output'))) {
            const outputs = await fs.readdir(path.resolve(folder, 'output'));
            files.push(...outputs.map((i) => `output/${i}`));
        }
        const result = readSubtasksFromFiles(files, checkFile, cfg, rst);
        Object.assign(config, result);
        if (cfg.isSelfSubmission) next({ message: { message: 'Found {0} testcases.', params: [config.count] } });
    } catch (e) {
        throw new SystemError('Cannot parse testdata.', [e.message, ...e.params]);
    }
    return config;
}

function isValidConfig(config) {
    if (config.count > (getConfig('testcases_max') || 100)) {
        throw new FormatError('Too many testcases. Cancelled.');
    }
    const time = sum(config.subtasks.map((subtask) => sum(subtask.cases.map((c) => c.time))));
    if (time > (getConfig('total_time_limit') || 60) * 1000) {
        throw new FormatError('Total time limit longer than {0}s. Cancelled.', [+getConfig('total_time_limit') || 60]);
    }
    const memMax = max(config.subtasks.map((subtask) => max(subtask.cases.map((c) => c.memory))));
    if (memMax > parseMemoryMB(getConfig('memoryMax'))) throw new FormatError('Memory limit larger than memory_max');
    if (!['default', 'strict'].includes(config.checker_type || 'default') && !config.checker) {
        throw new FormatError('You did not specify a checker.');
    }
}

export default async function readCases(folder: string, cfg: Record<string, any> = {}, args) {
    const iniConfig = path.resolve(folder, 'config.ini');
    const yamlConfig = path.resolve(folder, 'config.yaml');
    const ymlConfig = path.resolve(folder, 'config.yml');
    const config = { ...cfg };
    if (fs.existsSync(yamlConfig)) {
        Object.assign(config, yaml.load(fs.readFileSync(yamlConfig).toString()));
    } else if (fs.existsSync(ymlConfig)) {
        Object.assign(config, yaml.load(fs.readFileSync(ymlConfig).toString()));
    } else if (fs.existsSync(iniConfig)) {
        try {
            Object.assign(config, convertIniConfig(fs.readFileSync(iniConfig).toString()));
        } catch (e) {
            throw changeErrorType(e, FormatError);
        }
    }
    let result;
    try {
        result = await readYamlCases(config, ensureFile(folder));
    } catch (e) {
        throw changeErrorType(e, FormatError);
    }
    let cases = result.outputs?.length || 0;
    cases += Math.sum((result.subtasks || []).map((subtask) => subtask.cases.length));
    if (!cases) {
        const c = await readAutoCases(folder, args, config, result);
        result.subtasks = c.subtasks;
        result.count = c.count;
    }
    if (result.key && args.key !== result.key) throw new FormatError('Incorrect secret key');
    if (!result.key) isValidConfig(result);
    return result;
}
