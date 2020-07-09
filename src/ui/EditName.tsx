import styles from './EditName.module.css';
import React, { useCallback } from 'react';
import { useToggle } from '../react-hooks/useToggle';

type Props = {
  textClassName?: string;
  inputClassName?: string;
  text: string;
  placeholder?: string;
  onChangeText: (newText: string) => void;
  doubleClick?: boolean;
};

export function EditName({
  text,
  placeholder,
  onChangeText,
  textClassName = styles.text,
  inputClassName = styles.input,
  doubleClick = false,
}: Props) {
  const [editing, startEdit, finishEdit] = useToggle();
  const onSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      finishEdit();
    },
    [finishEdit],
  );

  const onChangeName = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChangeText(event.target.value);
    },
    [onChangeText],
  );
  return editing ? (
    <form onSubmit={onSubmit}>
      <input
        className={inputClassName}
        value={text}
        placeholder={placeholder}
        onChange={onChangeName}
        autoFocus={true}
        onBlur={finishEdit}
      />
    </form>
  ) : (
    <div
      className={textClassName}
      onClick={doubleClick ? undefined : startEdit}
      onDoubleClick={doubleClick ? startEdit : undefined}
      title={doubleClick ? 'Double-click to edit' : 'Click to edit'}
    >
      {text || placeholder}
    </div>
  );
}
