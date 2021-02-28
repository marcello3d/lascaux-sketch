import { Artboard, Id, UserMode } from '../lascaux/DrawingDoc';
import React, { useCallback, useMemo } from 'react';
import { Button } from '../ui/Button';
import classNames from 'classnames';
import styles from './LayerList.module.css';
import { Icon } from '../ui/Icon';
import { EditName } from '../ui/EditName';
import { IconsUrls } from './IconUrls';

type LayerListProps = {
  ids: Id[];
  artboard: Artboard;
  mode: UserMode;
  onSelectLayer: (id: Id) => void;
  onRenameLayer: (id: Id, newName: string) => void;
  iconUrls: IconsUrls;
};

export const LayerList = React.memo(function LayerList({
  ids,
  artboard,
  mode,
  onSelectLayer,
  onRenameLayer,
  iconUrls,
}: LayerListProps) {
  return (
    <span className={styles.layers}>
      {ids
        .map((id) => (
          <Layer
            key={id}
            id={id}
            artboard={artboard}
            mode={mode}
            iconUrls={iconUrls}
            onSelectLayer={onSelectLayer}
            onRenameLayer={onRenameLayer}
          />
        ))
        .reverse()}
    </span>
  );
});

type LayerProps = {
  id: string;
  artboard: Artboard;
  mode: UserMode;
  onSelectLayer: (id: string) => void;
  onRenameLayer: (id: string, newName: string) => void;
  iconUrls: IconsUrls;
};

function Layer({
  id,
  artboard,
  mode,
  onSelectLayer,
  onRenameLayer,
  iconUrls,
}: LayerProps) {
  const selected = id === mode.layer;
  const layer = artboard.layers[id];
  const onClick = useCallback(() => {
    if (!selected) {
      onSelectLayer(id);
    }
  }, [selected, onSelectLayer, id]);
  const name = useMemo(
    () =>
      layer.name ?? `Layer #${Object.keys(artboard.layers).indexOf(id) + 1}`,
    [layer.name, artboard.layers, id],
  );
  const onChangeName = useCallback(
    (name: string) => {
      onRenameLayer(id, name);
    },
    [id, onRenameLayer],
  );
  return (
    <>
      <Button
        className={classNames(styles.layer, {
          [styles.layerSelected]: selected,
        })}
        onClick={onClick}
      >
        <Icon
          file={selected ? iconUrls.selectedLayer : iconUrls.layer}
          alt={selected ? 'Selected layer' : 'Unselected layer'}
        />
        <EditName text={name} onChangeText={onChangeName} doubleClick={true} />
      </Button>
      {layer.type === 'group' && (
        <LayerList
          ids={layer.layers}
          artboard={artboard}
          mode={mode}
          iconUrls={iconUrls}
          onSelectLayer={onSelectLayer}
          onRenameLayer={onRenameLayer}
        />
      )}
    </>
  );
}
