import { useState } from "react";
import { Modal } from "./Modal";

const AreYouSureModal = ({
  action,
  onCancel,
  onConfirm,
}) => {
  return (
    <Modal>
      <div className="flex flex-col justify-center items-center rounded-lg p-2 bg-white/5 gap-2 ">
        <h2 className="text-lg font-semibold text-slate-500">¿Estás seguro?</h2>
        <p className="text-slate-500">{action}</p>
        <div className="flex justify-around w-full">
          <button
            className="bg-blue-300 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            className="bg-red-300 hover:bg-red-500 text-white font-bold py-2 px-4 rounded"
            onClick={onConfirm}
          >
            Confirmar
          </button>
        </div>
      </div>
    </Modal>
  );
}

export const GroupButtons = ({
  title,
  buttons,
}) => {
  const [modalProps, setModalProps] = useState();

  return (
    <div className="flex flex-col justify-center items-center rounded-lg p-2 bg-white/5 gap-2">
      { title && <h2 className="text-lg font-semibold">{title}</h2> }
      {buttons.map((button, index) => (
        <button
          key={index}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full"
          onClick={() => {
            if (button.confirm) {
              setModalProps({
                action: `${title} ${button.text}`,
                onConfirm: button.onClick,
                onCancel: () => setModalProps(null),
              });
            } else {
              button.onClick();
            }
          }}
        >
          {button.text}
        </button>
      ))}
      {modalProps && <AreYouSureModal {...modalProps} />}
    </div>
  );
}
