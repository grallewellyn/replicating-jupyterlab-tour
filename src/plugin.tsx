import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette, InputDialog } from '@jupyterlab/apputils';
import { IMainMenu, MainMenu } from '@jupyterlab/mainmenu';
import { INotebookTracker } from '@jupyterlab/notebook';
import { IStateDB } from '@jupyterlab/statedb';
import { ITranslator, nullTranslator } from '@jupyterlab/translation';

import React from 'react';
import ReactDOM from 'react-dom';
import { TourContainer } from './components';
import { CommandIDs, NOTEBOOK_ID, WELCOME_ID } from './constants';
import { addTours } from './defaults';
import {
  DEFAULTS_PLUGIN_ID,
  ITourHandler,
  ITourManager,
  PLUGIN_ID,
} from './tokens';
import { TourHandler } from './tour';
import { TourManager } from './tourManager';

const corePlugin: JupyterFrontEndPlugin<ITourManager> = {
  id: PLUGIN_ID,
  autoStart: true,
  activate,
  requires: [IStateDB],
  optional: [ICommandPalette, IMainMenu, ITranslator],
  provides: ITourManager
};

function activate(
  app: JupyterFrontEnd,
  stateDB: IStateDB,
  palette?: ICommandPalette,
  menu?: MainMenu,
  translator?: ITranslator
): ITourManager {
  const { commands } = app;

  translator = translator ?? nullTranslator;

  // Create tour manager
  const manager = new TourManager(stateDB, translator, menu);

  commands.addCommand(CommandIDs.launch, {
    label: args => {
      if (args['id']) {
        const tour = manager.tours.get(args['id'] as string) as TourHandler;
        return manager.translator.__(tour.label);
      } else {
        return manager.translator.__('Launch a Tour');
      }
    },
    usage: manager.translator.__(
      'Launch a tour.\nIf no id provided, prompt the user.\nArguments {id: Tour ID}'
    ),
    isEnabled: () => !manager.activeTour,
    execute: async args => {
      let id = args['id'] as string;
      const force =
        args['force'] === undefined ? true : (args['force'] as boolean);

      if (!id) {
        const answer = await InputDialog.getItem({
          items: Array.from(manager.tours.keys()),
          title: manager.translator.__('Choose a tour')
        });

        if (answer.button.accept && answer.value) {
          id = answer.value;
        } else {
          return;
        }
      }

      manager.launch([id], force);
    }
  });

  commands.addCommand(CommandIDs.addTour, {
    label: manager.translator.__('Add a tour'),
    usage: manager.translator.__(
      'Add a tour and returns it.\nArguments {tour: ITour}\nReturns `null` if a failure occurs.'
    ),
    execute: (args): ITourHandler | null => {
      return manager.addTour(args.tour as any);
    }
  });

  if (palette) {
    palette.addItem({
      category: manager.translator.__('Help'),
      command: CommandIDs.launch
    });
  }

  const node = document.createElement('div');

  document.body.appendChild(node);
  ReactDOM.render(<TourContainer tourLaunched={manager.tourLaunched} />, node);

  return manager;
}

const defaultsPlugin: JupyterFrontEndPlugin<void> = {
  id: DEFAULTS_PLUGIN_ID,
  autoStart: true,
  activate: activateDefaults,
  requires: [ITourManager],
  optional: [INotebookTracker]
};

function activateDefaults(
  app: JupyterFrontEnd,
  tourManager: ITourManager,
  nbTracker?: INotebookTracker
): void {
  addTours(tourManager, app, nbTracker);

  if (nbTracker) {
    nbTracker.widgetAdded.connect(() => {
      if (tourManager.tours.has(NOTEBOOK_ID)) {
        tourManager.launch([NOTEBOOK_ID], false);
      }
    });
  }

  app.restored.then(() => {
    if (tourManager.tours.has(WELCOME_ID)) {
      // Wait 3s before launching the first tour - to be sure element are loaded
      setTimeout(() => tourManager.launch([WELCOME_ID], false), 3000);
    }
  });
}

export default [corePlugin, defaultsPlugin];
