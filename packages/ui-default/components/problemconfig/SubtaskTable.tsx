import { Card, NumericInput, Tag } from '@blueprintjs/core';
import { pick, isEqual } from 'lodash';
import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { SubtaskConfig } from 'hydrooj/src/interface';
import { parseTimeMS, parseMemoryMB } from '@hydrooj/utils/lib/common';
import CustomSelectAutoComplete from '../autocomplete/components/CustomSelectAutoComplete';
import { FormItem, ManagedInput } from './BasicForm';
import { RootState } from './reducer';
import { CasesTable } from './TestCasesTable';

const eq = (a: SubtaskConfig, b: SubtaskConfig) => isEqual(a, b);

export function SubtasksIds({ index }) {
  const ids = useSelector((state: RootState) => state.config.subtasks.map((i) => i.id).filter((i) => i !== undefined).join(','));
  const subtaskIf = useSelector((state: RootState) => state.config.subtasks[index].if);
  const dispatch = useDispatch();
  return (
    <tr>
      <td style={{ textAlign: 'center' }}>if</td>
      <td colSpan={4}>
        <CustomSelectAutoComplete
          data={ids.split(',').filter((i) => i.length)}
          selectedKeys={subtaskIf?.map(String) || []}
          onChange={(val) => dispatch({
            type: 'CONFIG_SUBTASK_UPDATE', id: index, key: 'if', value: val.split(','),
          })}
          multi
        />
      </td>
    </tr>
  );
}

export function SubtasksTable({ index }) {
  const keys = ['id', 'type', 'score', 'time', 'memory'];
  const subtask = useSelector((state: RootState) => pick(state.config.subtasks[index], keys), eq);
  const defaultTime = useSelector((state: RootState) => state.config.time);
  const defaultMemory = useSelector((state: RootState) => state.config.memory);
  const dispatch = useDispatch();
  const dispatcher = (key: string, suffix = '') => (ev: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | number) => {
    let value = typeof ev !== 'object' ? ev : ev.currentTarget?.value;
    if (value === 0) value = '';
    if (value && suffix) value += suffix;
    dispatch({
      type: 'CONFIG_SUBTASK_UPDATE', id: index, key, value,
    });
  };
  return (
    <Card style={{ padding: 0 }}>
      <span>Subtasks #{index + 1} </span>
      <a onClick={() => dispatch({ type: 'CONFIG_SUBTASK_UPDATE', id: index, key: 'add' })}><span className="icon icon-add"></span></a>
      <a
        style={index === 0 ? { display: 'none' } : {}}
        onClick={() => dispatch({ type: 'CONFIG_SUBTASK_UPDATE', id: index, key: 'delete' })}
      >
        <span className="icon icon-delete"></span>
      </a>
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Score</th>
            <th>Type</th>
            <th>Time</th>
            <th>Memory</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            {['id', 'score'].map((key) => (
              <td key={key}>
                <input
                  value={subtask[key] || ''}
                  onChange={dispatcher(key)}
                  type="number"
                  className="textbox"
                />
              </td>
            ))}
            <td>
              <select
                value={subtask.type || ''}
                onChange={dispatcher('type')}
                className="select"
              >
                {['min', 'max', 'sum'].map((i) => (<option value={i} key={i}>{i}</option>))}
              </select>
            </td>
            <td>
              <NumericInput
                rightElement={<Tag minimal>ms</Tag>}
                value={subtask.time ? parseTimeMS(subtask.time).toString() : ''}
                placeholder={parseTimeMS(defaultTime || '1000ms').toString()}
                onValueChange={dispatcher('time', 'ms')}
                buttonPosition="none"
                fill
              />
            </td>
            <td>
              <NumericInput
                rightElement={<Tag minimal>MB</Tag>}
                value={subtask.memory ? parseMemoryMB(subtask.memory).toString() : ''}
                placeholder={parseMemoryMB(defaultMemory || '256m').toString()}
                onValueChange={dispatcher('memory', 'MB')}
                buttonPosition="none"
                fill
              />
            </td>
          </tr>
          <SubtasksIds index={index} />
        </tbody>
      </table>
      <CasesTable index={index} />
    </Card>
  );
}

export function TaskConfig() {
  const len = useSelector((state: RootState) => state.config.subtasks?.length);
  return (
    <FormItem columns={12} label="Task Settings">
      <div className="row">
        <FormItem columns={4} label="Time">
          <ManagedInput placeholder="Time" formKey="time" />
        </FormItem>
        <FormItem columns={4} label="Memory">
          <ManagedInput placeholder="Memory" formKey="memory" />
        </FormItem>
        <FormItem columns={4} label="Score">
          <ManagedInput placeholder="Score" formKey="score" />
        </FormItem>
        <FormItem columns={12} label="TestCases" disableLabel>
          {len && [...Array(len).keys()].map((i) => <SubtasksTable index={i} key={i} />)}
        </FormItem>
      </div>
    </FormItem>
  );
}
