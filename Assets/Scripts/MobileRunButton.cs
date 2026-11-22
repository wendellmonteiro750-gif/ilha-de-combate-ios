using UnityEngine;
using UnityEngine.EventSystems;

public class MobileRunButton : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IPointerExitHandler
{
    [SerializeField] private ThirdPersonMobileController playerController;
    public void OnPointerDown(PointerEventData eventData) { if (playerController) playerController.SetRunning(true); }
    public void OnPointerUp(PointerEventData eventData) { if (playerController) playerController.SetRunning(false); }
    public void OnPointerExit(PointerEventData eventData) { if (playerController) playerController.SetRunning(false); }
    private void OnDisable() { if (playerController) playerController.SetRunning(false); }
}
