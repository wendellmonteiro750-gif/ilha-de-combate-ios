using UnityEngine;
using UnityEngine.EventSystems;

public class VirtualJoystick : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IDragHandler
{
    [SerializeField] private RectTransform background;
    [SerializeField] private RectTransform handle;
    [SerializeField, Range(0.1f, 1f)] private float handleRange = 0.6f;
    public Vector2 Direction { get; private set; }

    public void OnPointerDown(PointerEventData eventData) => OnDrag(eventData);
    public void OnDrag(PointerEventData eventData)
    {
        if (!background || !handle) return;
        if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(background, eventData.position, eventData.pressEventCamera, out var local)) return;
        Vector2 half = background.rect.size * 0.5f;
        Direction = new Vector2(half.x > 0 ? local.x / half.x : 0, half.y > 0 ? local.y / half.y : 0);
        Direction = Vector2.ClampMagnitude(Direction, 1f);
        handle.anchoredPosition = new Vector2(Direction.x * half.x, Direction.y * half.y) * handleRange;
    }
    public void OnPointerUp(PointerEventData eventData)
    {
        Direction = Vector2.zero;
        if (handle) handle.anchoredPosition = Vector2.zero;
    }
}
